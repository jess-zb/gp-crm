/**
 * Repair enrollments cancelled as client_inactive by dispatch while
 * clients.unsubscribed_at was missing (PostgREST select failed → null client
 * → false cancel). Re-enrolls only clients who:
 *   - are still active + unsubscribed_at IS NULL
 *   - have a deliverable email
 *   - never received that sequence (no email_logs)
 *   - have no active/completed enrollment for that sequence
 *   - match the expected pipeline stage for the sequence
 *
 * Usage (preload stub so dispatch can import server-only admin client):
 *   node --require ./scripts/stub-server-only.cjs --import tsx scripts/repair-false-inactive-drip-cancels.ts
 *   node --require ./scripts/stub-server-only.cjs --import tsx scripts/repair-false-inactive-drip-cancels.ts --execute
 *   node --require ./scripts/stub-server-only.cjs --import tsx scripts/repair-false-inactive-drip-cancels.ts --execute --dispatch
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  enrollClientInEmailSequence,
  enrollClientInEmailSequenceBackdated,
} from "../lib/email/sequence-enrollment";

const SINCE = "2026-07-07T00:00:00.000Z";
const EXECUTE = process.argv.includes("--execute");
const DISPATCH = process.argv.includes("--dispatch");

type Candidate = {
  client_id: string;
  email: string;
  stage: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  stage_entered_at: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isDeliverable(email: string | null | undefined): email is string {
  if (!email) return false;
  const s = email.trim().toLowerCase();
  if (!EMAIL_RE.test(s)) return false;
  if (s.endsWith("@noemail.com") || s.endsWith("@example.com")) return false;
  return true;
}

async function loadCandidates(
  supabase: SupabaseClient,
  sequenceKey: string,
  stages: string[]
): Promise<Candidate[]> {
  // Cancelled by dispatch (no cancelled_at) as client_inactive, never sent a step.
  const { data: cancels, error } = await supabase
    .from("sequence_enrollments")
    .select("client_id, enrolled_at, last_step_sent, cancelled_at, cancel_reason, status")
    .eq("sequence_key", sequenceKey)
    .eq("status", "cancelled")
    .eq("cancel_reason", "client_inactive")
    .is("cancelled_at", null)
    .eq("last_step_sent", 0)
    .gte("enrolled_at", SINCE)
    .order("enrolled_at", { ascending: false });

  if (error) throw new Error(`load cancels ${sequenceKey}: ${error.message}`);

  const latestByClient = new Map<string, true>();
  const clientIds: string[] = [];
  for (const row of cancels ?? []) {
    const id = String(row.client_id);
    if (latestByClient.has(id)) continue;
    latestByClient.set(id, true);
    clientIds.push(id);
  }
  if (!clientIds.length) return [];

  const { data: clients, error: cErr } = await supabase
    .from("clients")
    .select("id, email, stage, first_name, last_name, created_at, stage_entered_at, is_active, unsubscribed_at")
    .in("id", clientIds)
    .eq("is_active", true)
    .is("unsubscribed_at", null)
    .in("stage", stages);

  if (cErr) throw new Error(`load clients ${sequenceKey}: ${cErr.message}`);

  const { data: logs } = await supabase
    .from("email_logs")
    .select("client_id")
    .eq("sequence_id", sequenceKey)
    .in("client_id", clientIds);
  const hasLog = new Set((logs ?? []).map((r) => String(r.client_id)));

  const { data: existing } = await supabase
    .from("sequence_enrollments")
    .select("client_id")
    .eq("sequence_key", sequenceKey)
    .in("status", ["active", "completed"])
    .in("client_id", clientIds);
  const hasEnroll = new Set((existing ?? []).map((r) => String(r.client_id)));

  const out: Candidate[] = [];
  for (const c of clients ?? []) {
    const id = String(c.id);
    if (hasLog.has(id) || hasEnroll.has(id)) continue;
    if (!isDeliverable(c.email as string | null)) continue;
    out.push({
      client_id: id,
      email: String(c.email).trim(),
      stage: String(c.stage),
      first_name: (c.first_name as string | null) ?? null,
      last_name: (c.last_name as string | null) ?? null,
      created_at: String(c.created_at),
      stage_entered_at: (c.stage_entered_at as string | null) ?? null,
    });
  }
  return out;
}

async function preflight(supabase: SupabaseClient): Promise<void> {
  const { data: colProbe, error } = await supabase
    .from("clients")
    .select("id, unsubscribed_at, is_active")
    .limit(1);
  if (error) {
    throw new Error(
      `Preflight FAILED — clients.unsubscribed_at not selectable: ${error.message}. Aborting.`
    );
  }
  if (!colProbe) {
    throw new Error("Preflight FAILED — unexpected empty clients probe.");
  }

  const { data: setting } = await supabase
    .from("crm_settings")
    .select("value")
    .eq("key", "email_sequences_enabled")
    .maybeSingle();
  if (setting?.value !== "true") {
    throw new Error(`Preflight FAILED — email_sequences_enabled=${setting?.value ?? "missing"}`);
  }

  for (const key of ["welcome_lead", "welcome_cs", "active_arc", "partial_arc"] as const) {
    const { data: seq } = await supabase
      .from("email_sequences")
      .select("is_active")
      .eq("key", key)
      .maybeSingle();
    if (!seq || seq.is_active === false) {
      throw new Error(`Preflight FAILED — sequence ${key} missing or inactive`);
    }
    const { data: step } = await supabase
      .from("comm_templates")
      .select("template_key")
      .eq("sequence_key", key)
      .eq("step_order", 1)
      .eq("is_active", true)
      .maybeSingle();
    if (!step) throw new Error(`Preflight FAILED — no active step 1 for ${key}`);
  }

  console.log("Preflight OK: unsubscribed_at selectable, kill switch on, templates present.");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await preflight(supabase);

  const cohorts: {
    sequenceKey: string;
    stages: string[];
    mode: "fresh" | "backdated";
    candidates: Candidate[];
  }[] = [
    {
      sequenceKey: "welcome_lead",
      stages: ["lead"],
      mode: "fresh",
      candidates: await loadCandidates(supabase, "welcome_lead", ["lead"]),
    },
    {
      sequenceKey: "welcome_cs",
      stages: ["client_services"],
      mode: "fresh",
      candidates: await loadCandidates(supabase, "welcome_cs", ["client_services"]),
    },
    {
      sequenceKey: "partial_arc",
      stages: ["welcome_packet"],
      mode: "backdated",
      candidates: await loadCandidates(supabase, "partial_arc", ["welcome_packet"]),
    },
    {
      sequenceKey: "active_arc",
      stages: ["client_services", "retention", "awaiting_collection_letter"],
      mode: "backdated",
      candidates: await loadCandidates(supabase, "active_arc", [
        "client_services",
        "retention",
        "awaiting_collection_letter",
      ]),
    },
  ];

  let total = 0;
  for (const cohort of cohorts) {
    total += cohort.candidates.length;
    console.log(
      `\n${cohort.sequenceKey} (${cohort.mode}) → ${cohort.candidates.length} clients [${cohort.stages.join(", ")}]`
    );
    for (const c of cohort.candidates.slice(0, 5)) {
      console.log(
        `  sample: ${c.first_name ?? ""} ${c.last_name ?? ""} | ${c.stage} | ${c.email}`
      );
    }
    if (cohort.candidates.length > 5) {
      console.log(`  … +${cohort.candidates.length - 5} more`);
    }
  }
  console.log(`\nTOTAL candidates: ${total}`);
  console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY-RUN"}`);

  if (!EXECUTE) {
    console.log("\nDry-run only. Re-run with --execute to enroll.");
    return;
  }

  const summary: Record<string, { enrolled: number; skipped: Record<string, number> }> = {};

  for (const cohort of cohorts) {
    const skipped: Record<string, number> = {};
    let enrolled = 0;
    for (const c of cohort.candidates) {
      let res;
      if (cohort.mode === "fresh") {
        res = await enrollClientInEmailSequence(supabase, {
          clientId: c.client_id,
          sequenceKey: cohort.sequenceKey,
          clientEmail: c.email,
        });
      } else {
        const ref = new Date(c.stage_entered_at || c.created_at);
        res = await enrollClientInEmailSequenceBackdated(supabase, {
          clientId: c.client_id,
          sequenceKey: cohort.sequenceKey,
          referenceDate: ref,
          clientEmail: c.email,
        });
      }
      if (res.ok) enrolled++;
      else skipped[res.reason] = (skipped[res.reason] ?? 0) + 1;
    }
    summary[cohort.sequenceKey] = { enrolled, skipped };
    console.log(`Enrolled ${cohort.sequenceKey}: ${enrolled}`, skipped);
  }

  if (DISPATCH) {
    // Requires: node --require ./scripts/stub-server-only.cjs --import tsx …
    const { runEmailDispatch } = await import("../lib/email/dispatch-for-client");
    // Dispatch processes up to `limit` due rows per call; loop until idle.
    for (let i = 0; i < 15; i++) {
      const result = await runEmailDispatch({ limit: 100 });
      console.log(`Dispatch pass ${i + 1}:`, result);
      if (result.message === "no_emails_due") break;
      if ((result.processed ?? 0) === 0 && (result.errors ?? 0) === 0 && (result.skipped_steps ?? 0) === 0) {
        break;
      }
    }
  } else {
    console.log("\nEnrollments created with next_send_at ≈ now (day_offset 0 for welcomes).");
    console.log("Hourly cron will send, or re-run with --dispatch.");
  }

  console.log("\nDone.", summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
