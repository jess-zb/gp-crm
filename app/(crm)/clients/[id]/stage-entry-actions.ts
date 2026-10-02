"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { cancelActiveSequenceEnrollments } from "@/lib/email/sequence-enrollment";
import { runEmailDispatch } from "@/lib/email/dispatch-for-client";
import {
  runStageEntrySideEffects,
  type StageEntrySideEffectsArgs,
} from "@/lib/reminders/stage-entry-appointments";
import { autoMatchAndSaveMerchant } from "@/lib/packets/resolve-merchant";

/**
 * Explicit allowlist of non-portal staff roles. Kept as an allowlist (not a
 * `!== "client"` denylist) so a future role can't silently inherit the
 * service-role (RLS-bypass) write access these actions grant.
 */
const STAFF_ROLES = new Set(["dev", "admin", "acct_manager", "attorney"]);

/**
 * These actions elevate to the service-role client (RLS bypassed), so every
 * exported action MUST verify the caller is authenticated staff FIRST. Uses
 * the RLS-scoped client to identify the caller; throws (via redirect) for
 * anonymous callers or non-staff.
 */
async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error: profErr } = await getProfileForUser(supabase, user);
  if (profErr || !profile) {
    if (profErr) console.error("[stage-entry-actions] profile error:", profErr);
    redirect("/login");
  }
  if (!STAFF_ROLES.has(profile.role)) redirect("/portal");

  return { user, profile };
}

export async function runStageEntrySideEffectsServerAction(
  args: StageEntrySideEffectsArgs
): Promise<void> {
  await requireStaff();
  const supabase = createServiceClient();
  await runStageEntrySideEffects(supabase, args);

  if (args.forward && args.newStage === "welcome_packet") {
    const { data: client } = await supabase
      .from("clients")
      .select("first_name, last_name")
      .eq("id", args.clientId)
      .maybeSingle();
    await autoMatchAndSaveMerchant(
      args.clientId,
      (client?.first_name as string | null) ?? null,
      (client?.last_name as string | null) ?? null
    ).catch((err) =>
      console.warn("[stage-entry] merchant auto-match failed:", err)
    );
  }

  // Day-0 drip emails: fire immediately instead of waiting up to 60 min
  // for the hourly cron. The DB trigger has already inserted any
  // enrollments by this point. Later steps still ride the cron.
  try {
    await runEmailDispatch({ clientId: args.clientId });
  } catch (err) {
    console.warn("[stage-entry] inline email dispatch failed:", err);
  }
}

export async function cancelActiveSequenceEnrollmentsServerAction(
  clientId: string
): Promise<void> {
  await requireStaff();
  const supabase = createServiceClient();
  await cancelActiveSequenceEnrollments(supabase, clientId);
}

/**
 * Toggle a single step_order in `sequence_enrollments.skipped_step_orders`
 * for the given enrollment. Re-enabling a previously-skipped step removes
 * it from the array. The dispatcher walks past any skipped step at send time.
 */
export async function toggleSequenceStepSkipServerAction(args: {
  clientId: string;
  enrollmentId: string;
  stepOrder: number;
}): Promise<{ ok: true; skipped: boolean } | { ok: false; error: string }> {
  await requireStaff();
  const { clientId, enrollmentId, stepOrder } = args;
  if (!clientId || !enrollmentId || !Number.isFinite(stepOrder)) {
    return { ok: false, error: "Missing required fields" };
  }

  const supabase = createServiceClient();

  const { data: row, error: fetchErr } = await supabase
    .from("sequence_enrollments")
    .select("id, client_id, skipped_step_orders")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, error: "Enrollment not found" };
  }
  if (String(row.client_id) !== String(clientId)) {
    return { ok: false, error: "Enrollment does not belong to this client" };
  }

  const current = new Set<number>(
    Array.isArray(row.skipped_step_orders)
      ? (row.skipped_step_orders as number[])
      : []
  );
  const willSkip = !current.has(stepOrder);
  if (willSkip) current.add(stepOrder);
  else current.delete(stepOrder);

  const { error: updateErr } = await supabase
    .from("sequence_enrollments")
    .update({ skipped_step_orders: Array.from(current).sort((a, b) => a - b) })
    .eq("id", enrollmentId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }
  return { ok: true, skipped: willSkip };
}
