"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import {
  enrollClientInEmailSequence,
  enrollClientInEmailSequenceBackdated,
} from "@/lib/email/sequence-enrollment";
import { isDev } from "@/lib/roles";
import type { SupabaseClient } from "@supabase/supabase-js";

type BackfillResult =
  | {
      ok: true;
      processed: number;
      enrolled: number;
      skipped: number;
      reasons: Record<string, number>;
    }
  | { ok: false; error: string };

type ClientRow = { id: string; created_at: string | null; email: string | null };
type StrandedRow = { id: string; first_name: string | null; last_name: string | null; created_at: string | null };

async function requireDev() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, ok: false as const, error: "Not signed in" };
  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !isDev(profile.role)) return { supabase, ok: false as const, error: "Not authorized" };
  return { supabase, ok: true as const };
}

/** Look up the most recent stage-entry audit date for each client. */
async function stageEntryDates(
  supabase: SupabaseClient,
  clientIds: string[],
  stage: string
): Promise<Record<string, string>> {
  if (!clientIds.length) return {};
  const { data: audits } = await supabase
    .from("audit_log")
    .select("client_id, created_at, new_value")
    .in("client_id", clientIds)
    .in("action", ["stage_advanced", "stage_reverted"])
    .order("created_at", { ascending: false });
  const map: Record<string, string> = {};
  for (const row of audits ?? []) {
    const cid = row.client_id as string;
    if (map[cid]) continue;
    if ((row.new_value as { stage?: string } | null)?.stage === stage) {
      map[cid] = row.created_at as string;
    }
  }
  return map;
}

/**
 * Single-step sequences (welcome_lead, welcome_cs, case_referred) should be sent
 * fresh from today when backfilling — otherwise the backdated logic skips them
 * because there's no future step to schedule and returns sequence_complete.
 * Multi-step sequences (active_arc, partial_arc) get backdated so already-past
 * steps are marked sent and the client picks up mid-arc.
 */
const SINGLE_STEP_SEQUENCES = new Set(["welcome_lead", "welcome_cs", "case_referred"]);

async function runBackfill(
  supabase: SupabaseClient,
  candidates: ClientRow[],
  sequenceKeys: string[],
  refDates: Record<string, string>
): Promise<{ enrolled: number; skipped: number; reasons: Record<string, number> }> {
  let enrolled = 0;
  let skipped = 0;
  const reasons: Record<string, number> = {};
  for (const client of candidates) {
    for (const key of sequenceKeys) {
      let res;
      if (SINGLE_STEP_SEQUENCES.has(key)) {
        res = await enrollClientInEmailSequence(supabase, {
          clientId: client.id,
          sequenceKey: key,
          clientEmail: client.email,
        });
      } else {
        const refIso = refDates[client.id] ?? client.created_at;
        if (!refIso) {
          skipped++;
          reasons.no_reference_date = (reasons.no_reference_date ?? 0) + 1;
          continue;
        }
        res = await enrollClientInEmailSequenceBackdated(supabase, {
          clientId: client.id,
          sequenceKey: key,
          referenceDate: new Date(refIso),
          clientEmail: client.email,
        });
      }
      if (res.ok) enrolled++;
      else { skipped++; reasons[res.reason] = (reasons[res.reason] ?? 0) + 1; }
    }
  }
  return { enrolled, skipped, reasons };
}

// ─── Client Services ─────────────────────────────────────────────────────────

export async function listStrandedClientServices(): Promise<
  { ok: true; count: number; sample: StrandedRow[] } | { ok: false; error: string }
> {
  const auth = await requireDev();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, created_at")
    .eq("is_active", true)
    .eq("stage", "client_services");
  if (error) return { ok: false, error: error.message };
  const list = (clients ?? []) as (StrandedRow & { id: string })[];
  if (!list.length) return { ok: true, count: 0, sample: [] };
  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("client_id")
    .in("client_id", list.map((c) => c.id))
    .eq("status", "active")
    .eq("sequence_key", "welcome_cs");
  const enrolled = new Set((enrollments ?? []).map((r) => r.client_id as string));
  const stranded = list.filter((c) => !enrolled.has(c.id));
  return { ok: true, count: stranded.length, sample: stranded.slice(0, 10) };
}

export async function backfillClientServicesDrips(): Promise<BackfillResult> {
  const auth = await requireDev();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const { data, error } = await supabase
    .from("clients")
    .select("id, created_at, email")
    .eq("is_active", true)
    .eq("stage", "client_services");
  if (error) return { ok: false, error: error.message };
  const candidates = (data ?? []) as ClientRow[];
  const refDates = await stageEntryDates(supabase, candidates.map((c) => c.id), "client_services");
  const { enrolled, skipped, reasons } = await runBackfill(supabase, candidates, ["welcome_cs", "active_arc"], refDates);
  return { ok: true, processed: candidates.length, enrolled, skipped, reasons };
}

// ─── New Lead ─────────────────────────────────────────────────────────────────

export async function listStrandedLeads(): Promise<
  { ok: true; count: number; sample: StrandedRow[] } | { ok: false; error: string }
> {
  const auth = await requireDev();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, created_at")
    .eq("is_active", true)
    .eq("stage", "lead");
  if (error) return { ok: false, error: error.message };
  const list = (clients ?? []) as (StrandedRow & { id: string })[];
  if (!list.length) return { ok: true, count: 0, sample: [] };
  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("client_id")
    .in("client_id", list.map((c) => c.id))
    .eq("status", "active")
    .eq("sequence_key", "welcome_lead");
  const enrolled = new Set((enrollments ?? []).map((r) => r.client_id as string));
  const stranded = list.filter((c) => !enrolled.has(c.id));
  return { ok: true, count: stranded.length, sample: stranded.slice(0, 10) };
}

export async function backfillLeadDrips(): Promise<BackfillResult> {
  const auth = await requireDev();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const { data, error } = await supabase
    .from("clients")
    .select("id, created_at, email")
    .eq("is_active", true)
    .eq("stage", "lead");
  if (error) return { ok: false, error: error.message };
  const candidates = (data ?? []) as ClientRow[];
  const { enrolled, skipped, reasons } = await runBackfill(supabase, candidates, ["welcome_lead"], {});
  return { ok: true, processed: candidates.length, enrolled, skipped, reasons };
}

// ─── Account Manager (welcome_packet) ────────────────────────────────────────

export async function listStrandedAccountManager(): Promise<
  { ok: true; count: number; sample: StrandedRow[] } | { ok: false; error: string }
> {
  const auth = await requireDev();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, created_at")
    .eq("is_active", true)
    .eq("stage", "welcome_packet");
  if (error) return { ok: false, error: error.message };
  const list = (clients ?? []) as (StrandedRow & { id: string })[];
  if (!list.length) return { ok: true, count: 0, sample: [] };
  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("client_id")
    .in("client_id", list.map((c) => c.id))
    .eq("status", "active")
    .eq("sequence_key", "partial_arc");
  const enrolled = new Set((enrollments ?? []).map((r) => r.client_id as string));
  const stranded = list.filter((c) => !enrolled.has(c.id));
  return { ok: true, count: stranded.length, sample: stranded.slice(0, 10) };
}

export async function backfillAccountManagerDrips(): Promise<BackfillResult> {
  const auth = await requireDev();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const { data, error } = await supabase
    .from("clients")
    .select("id, created_at, email")
    .eq("is_active", true)
    .eq("stage", "welcome_packet");
  if (error) return { ok: false, error: error.message };
  const candidates = (data ?? []) as ClientRow[];
  const refDates = await stageEntryDates(supabase, candidates.map((c) => c.id), "welcome_packet");
  const { enrolled, skipped, reasons } = await runBackfill(supabase, candidates, ["partial_arc"], refDates);
  return { ok: true, processed: candidates.length, enrolled, skipped, reasons };
}

// ─── Retention + Awaiting Collections (active_arc continuation) ───────────────

export async function listStrandedActiveArc(): Promise<
  { ok: true; count: number; sample: StrandedRow[] } | { ok: false; error: string }
> {
  const auth = await requireDev();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, created_at")
    .eq("is_active", true)
    .in("stage", ["retention", "awaiting_collection_letter"]);
  if (error) return { ok: false, error: error.message };
  const list = (clients ?? []) as (StrandedRow & { id: string })[];
  if (!list.length) return { ok: true, count: 0, sample: [] };
  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("client_id")
    .in("client_id", list.map((c) => c.id))
    .eq("status", "active")
    .eq("sequence_key", "active_arc");
  const enrolled = new Set((enrollments ?? []).map((r) => r.client_id as string));
  const stranded = list.filter((c) => !enrolled.has(c.id));
  return { ok: true, count: stranded.length, sample: stranded.slice(0, 10) };
}

export async function backfillActiveArcDrips(): Promise<BackfillResult> {
  const auth = await requireDev();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const { data, error } = await supabase
    .from("clients")
    .select("id, created_at, email, stage")
    .eq("is_active", true)
    .in("stage", ["retention", "awaiting_collection_letter"]);
  if (error) return { ok: false, error: error.message };
  const candidates = (data ?? []) as (ClientRow & { stage: string })[];
  const refDates = await stageEntryDates(supabase, candidates.map((c) => c.id), "client_services");
  const { enrolled, skipped, reasons } = await runBackfill(supabase, candidates, ["active_arc"], refDates);
  return { ok: true, processed: candidates.length, enrolled, skipped, reasons };
}

// ─── Case Sent to Attorneys ───────────────────────────────────────────────────

export async function listStrandedCaseReferred(): Promise<
  { ok: true; count: number; sample: StrandedRow[] } | { ok: false; error: string }
> {
  const auth = await requireDev();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, created_at")
    .eq("is_active", true)
    .eq("stage", "case_sent_to_attorneys");
  if (error) return { ok: false, error: error.message };
  const list = (clients ?? []) as (StrandedRow & { id: string })[];
  if (!list.length) return { ok: true, count: 0, sample: [] };
  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("client_id")
    .in("client_id", list.map((c) => c.id))
    .in("status", ["active", "completed"])
    .eq("sequence_key", "case_referred");
  const enrolled = new Set((enrollments ?? []).map((r) => r.client_id as string));
  const stranded = list.filter((c) => !enrolled.has(c.id));
  return { ok: true, count: stranded.length, sample: stranded.slice(0, 10) };
}

export async function backfillCaseReferredDrips(): Promise<BackfillResult> {
  const auth = await requireDev();
  if (!auth.ok) return auth;
  const { supabase } = auth;
  const { data, error } = await supabase
    .from("clients")
    .select("id, created_at, email")
    .eq("is_active", true)
    .eq("stage", "case_sent_to_attorneys");
  if (error) return { ok: false, error: error.message };
  const candidates = (data ?? []) as ClientRow[];
  const refDates = await stageEntryDates(supabase, candidates.map((c) => c.id), "case_sent_to_attorneys");
  const { enrolled, skipped, reasons } = await runBackfill(supabase, candidates, ["case_referred"], refDates);
  return { ok: true, processed: candidates.length, enrolled, skipped, reasons };
}
