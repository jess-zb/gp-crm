import type { SupabaseClient } from "@supabase/supabase-js";

export type EnrollResult =
  | { ok: true }
  | { ok: false; reason: string };

const TERMINAL_CANCEL_REASON = "terminal_stage";

async function resolveClientEmail(
  supabase: SupabaseClient,
  clientId: string,
  hint?: string | null
): Promise<string | null> {
  const trimmed = hint?.trim();
  if (trimmed) return trimmed;
  const { data, error } = await supabase.from("clients").select("email").eq("id", clientId).maybeSingle();
  if (error) {
    console.error("[sequence-enrollment] resolve email error:", error.message);
  }
  return (data?.email as string | null)?.trim() || null;
}

/**
 * Cancel specific active enrollments by sequence key (e.g. active_arc when
 * entering case_sent_to_attorneys). Leaves all other active sequences untouched.
 */
export async function cancelSequencesByKeys(
  supabase: SupabaseClient,
  clientId: string,
  keys: string[],
  reason = "stage_change"
): Promise<void> {
  if (!keys.length) return;
  const { error } = await supabase
    .from("sequence_enrollments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      next_send_at: null,
      cancel_reason: reason,
    })
    .eq("client_id", clientId)
    .eq("status", "active")
    .in("sequence_key", keys);
  if (error) {
    console.error("[sequence-enrollment] cancelSequencesByKeys error:", error.message);
  }
}

/**
 * Reactivate a previously-cancelled enrollment, resuming from exactly where it
 * left off. Used when a client is moved back to a stage (e.g. case_sent_to_attorneys
 * → awaiting_collection_letter) and the cancellation was a user error.
 *
 * Looks for the most recently cancelled enrollment for this client + sequence whose
 * cancel_reason matches. If found, restores status to active and recalculates
 * next_send_at from the original enrolled_at + next step's day_offset.
 * Falls back to a fresh enrollment if no matching cancelled row exists.
 */
export async function reactivateOrEnrollSequence(
  supabase: SupabaseClient,
  args: {
    clientId: string;
    sequenceKey: string;
    cancelReason: string;
    clientEmail?: string | null;
  }
): Promise<EnrollResult> {
  // Check for an already-active enrollment first — nothing to do
  const { data: active } = await supabase
    .from("sequence_enrollments")
    .select("id")
    .eq("client_id", args.clientId)
    .eq("sequence_key", args.sequenceKey)
    .eq("status", "active")
    .maybeSingle();
  if (active) return { ok: false, reason: "already_enrolled" };

  // Find the most recent cancelled enrollment from the expected reason
  const { data: cancelled } = await supabase
    .from("sequence_enrollments")
    .select("id, enrolled_at, last_step_sent")
    .eq("client_id", args.clientId)
    .eq("sequence_key", args.sequenceKey)
    .eq("status", "cancelled")
    .eq("cancel_reason", args.cancelReason)
    .order("cancelled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cancelled) {
    // No prior cancelled enrollment — fresh enroll instead
    return enrollClientInEmailSequence(supabase, {
      clientId: args.clientId,
      sequenceKey: args.sequenceKey,
      clientEmail: args.clientEmail,
    });
  }

  const nextStep = Number(cancelled.last_step_sent ?? 0) + 1;
  const enrolledAt = new Date(String(cancelled.enrolled_at));

  const { data: nextTmpl } = await supabase
    .from("comm_templates")
    .select("day_offset")
    .eq("sequence_key", args.sequenceKey)
    .eq("step_order", nextStep)
    .eq("is_active", true)
    .maybeSingle();

  if (!nextTmpl) {
    // Sequence was already complete when it was cancelled — nothing left to send
    return { ok: false, reason: "sequence_complete" };
  }

  const nextSendAt = new Date(enrolledAt);
  nextSendAt.setDate(nextSendAt.getDate() + Number(nextTmpl.day_offset ?? 0));

  const { error } = await supabase
    .from("sequence_enrollments")
    .update({
      status: "active",
      cancelled_at: null,
      cancel_reason: null,
      next_send_at: nextSendAt.toISOString(),
    })
    .eq("id", String(cancelled.id));

  if (error) {
    console.error("[sequence-enrollment] reactivate error:", error.message);
    return { ok: false, reason: "database_error" };
  }
  return { ok: true };
}

/** Cancel all active drip enrollments for a client (DNC / closed / not interested). */
export async function cancelActiveSequenceEnrollments(
  supabase: SupabaseClient,
  clientId: string,
  reason = TERMINAL_CANCEL_REASON
): Promise<void> {
  const { error } = await supabase
    .from("sequence_enrollments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      next_send_at: null,
      cancel_reason: reason,
    })
    .eq("client_id", clientId)
    .eq("status", "active");
  if (error) {
    console.error("[sequence-enrollment] cancel active error:", error.message);
  }
}

/**
 * Enroll a client in a drip by `sequence_key` (welcome_lead, welcome_cs, etc.).
 * Uses `sequence_enrollments` + `comm_templates` for step timing.
 */
export async function enrollClientInEmailSequence(
  supabase: SupabaseClient,
  args: {
    clientId: string;
    sequenceKey: string;
    clientEmail?: string | null;
    /** When true, skip if any enrollment exists with status active or completed (e.g. partial_arc). */
    blockIfEverStarted?: boolean;
  }
): Promise<EnrollResult> {
  const email = await resolveClientEmail(supabase, args.clientId, args.clientEmail);
  if (!email) return { ok: false, reason: "no_email" };

  // Refuse to enroll into a disabled sequence — otherwise we accumulate orphan
  // enrollments that can never send (root cause of the 2026-06-22..07-01 backlog
  // of 1,405 follow_up_24hr rows).
  const { data: sequence } = await supabase
    .from("email_sequences")
    .select("is_active")
    .eq("key", args.sequenceKey)
    .maybeSingle();
  if (!sequence || sequence.is_active === false) {
    return { ok: false, reason: "sequence_disabled" };
  }

  let existingQuery = supabase
    .from("sequence_enrollments")
    .select("id, status")
    .eq("client_id", args.clientId)
    .eq("sequence_key", args.sequenceKey);

  if (args.blockIfEverStarted) {
    existingQuery = existingQuery.in("status", ["active", "completed"]);
  } else {
    existingQuery = existingQuery.eq("status", "active");
  }

  const { data: existing, error: existErr } = await existingQuery.maybeSingle();
  if (existErr) {
    console.error("[sequence-enrollment] check existing error:", existErr.message);
  }
  if (existing) return { ok: false, reason: "already_enrolled" };

  const { data: firstStep, error: firstStepErr } = await supabase
    .from("comm_templates")
    .select("day_offset, step_order")
    .eq("sequence_key", args.sequenceKey)
    .eq("step_order", 1)
    .eq("is_active", true)
    .maybeSingle();

  if (firstStepErr) {
    console.error("[sequence-enrollment] first step fetch error:", firstStepErr.message);
  }
  if (!firstStep) {
    return { ok: false, reason: "no_active_template" };
  }

  const enrolledAt = new Date();
  const nextSendAt = new Date(enrolledAt);
  nextSendAt.setDate(nextSendAt.getDate() + (firstStep.day_offset ?? 0));

  const { error: insErr } = await supabase.from("sequence_enrollments").insert({
    client_id: args.clientId,
    sequence_key: args.sequenceKey,
    sequence_id: args.sequenceKey,
    status: "active",
    enrolled_at: enrolledAt.toISOString(),
    last_step_sent: 0,
    current_step: 0,
    next_send_at: nextSendAt.toISOString(),
  });

  if (insErr) {
    console.error("[sequence-enrollment] insert error:", insErr.message);
    return { ok: false, reason: "database_error" };
  }

  return { ok: true };
}

/** Alias for specs that refer to `enrollInSequence`. */
export const enrollInSequence = enrollClientInEmailSequence;

/**
 * Backdated enrollment for backfilling stranded clients. Skips steps whose
 * scheduled date (referenceDate + day_offset) is already in the past so the
 * client never receives emails they should have received weeks ago — only the
 * next-due step and onward. Idempotent: refuses if an active/completed
 * enrollment for the sequence already exists.
 */
export async function enrollClientInEmailSequenceBackdated(
  supabase: SupabaseClient,
  args: {
    clientId: string;
    sequenceKey: string;
    referenceDate: Date;
    clientEmail?: string | null;
  }
): Promise<EnrollResult> {
  const email = await resolveClientEmail(supabase, args.clientId, args.clientEmail);
  if (!email) return { ok: false, reason: "no_email" };

  const { data: sequence } = await supabase
    .from("email_sequences")
    .select("is_active")
    .eq("key", args.sequenceKey)
    .maybeSingle();
  if (!sequence || sequence.is_active === false) {
    return { ok: false, reason: "sequence_disabled" };
  }

  const { data: existing } = await supabase
    .from("sequence_enrollments")
    .select("id")
    .eq("client_id", args.clientId)
    .eq("sequence_key", args.sequenceKey)
    .in("status", ["active", "completed"])
    .maybeSingle();
  if (existing) return { ok: false, reason: "already_enrolled" };

  const { data: templatesRaw, error: tmplErr } = await supabase
    .from("comm_templates")
    .select("step_order, day_offset")
    .eq("sequence_key", args.sequenceKey)
    .eq("is_active", true)
    .order("step_order", { ascending: true });

  if (tmplErr) {
    console.error("[sequence-enrollment] templates error:", tmplErr.message);
    return { ok: false, reason: "database_error" };
  }
  const templates = (templatesRaw ?? []) as { step_order: number | null; day_offset: number | null }[];
  if (!templates.length) return { ok: false, reason: "no_active_template" };

  const now = new Date();
  const referenceDate = args.referenceDate;

  let lastStepSent = 0;
  let nextStep: { step_order: number; day_offset: number } | null = null;
  for (const t of templates) {
    const step = Number(t.step_order ?? 0);
    const offset = Number(t.day_offset ?? 0);
    if (step <= 0) continue;
    const scheduled = new Date(referenceDate);
    scheduled.setDate(scheduled.getDate() + offset);
    if (scheduled.getTime() <= now.getTime()) {
      lastStepSent = Math.max(lastStepSent, step);
    } else if (!nextStep) {
      nextStep = { step_order: step, day_offset: offset };
    }
  }

  if (!nextStep) {
    return { ok: false, reason: "sequence_complete" };
  }

  const nextSendAt = new Date(referenceDate);
  nextSendAt.setDate(nextSendAt.getDate() + nextStep.day_offset);

  const { error: insErr } = await supabase.from("sequence_enrollments").insert({
    client_id: args.clientId,
    sequence_key: args.sequenceKey,
    sequence_id: args.sequenceKey,
    status: "active",
    enrolled_at: referenceDate.toISOString(),
    last_step_sent: lastStepSent,
    current_step: lastStepSent,
    next_send_at: nextSendAt.toISOString(),
  });

  if (insErr) {
    console.error("[sequence-enrollment] backdated insert error:", insErr.message);
    return { ok: false, reason: "database_error" };
  }

  return { ok: true };
}
