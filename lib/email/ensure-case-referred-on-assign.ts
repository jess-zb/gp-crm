import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enrollClientInEmailSequence,
  reactivateOrEnrollSequence,
} from "@/lib/email/sequence-enrollment";
import { runEmailDispatch } from "@/lib/email/dispatch-for-client";
import { isDeliverableEmail } from "@/lib/email/is-deliverable-email";

export type CaseReferredEnsureResult =
  | {
      ok: true;
      mode: "enrolled" | "reactivated" | "already_active" | "already_completed";
      sentNow: boolean;
    }
  | { ok: false; reason: string };

async function dispatchCaseReferredNow(clientId: string): Promise<boolean> {
  const result = await runEmailDispatch({ clientId, limit: 5 });
  return result.processed > 0;
}

/**
 * Enroll (or re-queue) case_referred for portal assignment, send immediately
 * when possible, and leave the enrollment due for cron if instant send fails.
 */
export async function ensureCaseReferredOnAssign(
  supabase: SupabaseClient,
  args: { clientId: string; clientEmail: string | null }
): Promise<CaseReferredEnsureResult> {
  if (!isDeliverableEmail(args.clientEmail)) {
    return { ok: false, reason: "no_email" };
  }

  const { data: existing } = await supabase
    .from("sequence_enrollments")
    .select("id, status")
    .eq("client_id", args.clientId)
    .eq("sequence_key", "case_referred")
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = (existing?.status as string | undefined) ?? null;
  if (status === "completed") {
    return { ok: true, mode: "already_completed", sentNow: false };
  }

  const bumpNextSend = async () => {
    if (!existing?.id) return;
    await supabase
      .from("sequence_enrollments")
      .update({ next_send_at: new Date().toISOString() })
      .eq("id", existing.id as string);
  };

  if (status === "active") {
    await bumpNextSend();
    const sentNow = await dispatchCaseReferredNow(args.clientId);
    return { ok: true, mode: "already_active", sentNow };
  }

  if (status === "cancelled") {
    const reactivated = await reactivateOrEnrollSequence(supabase, {
      clientId: args.clientId,
      sequenceKey: "case_referred",
      cancelReason: "case_sent_to_attorneys",
      clientEmail: args.clientEmail,
    });
    if (!reactivated.ok && reactivated.reason !== "already_enrolled") {
      const enrolled = await enrollClientInEmailSequence(supabase, {
        clientId: args.clientId,
        sequenceKey: "case_referred",
        clientEmail: args.clientEmail,
      });
      if (!enrolled.ok) {
        return { ok: false, reason: enrolled.reason };
      }
      const sentNow = await dispatchCaseReferredNow(args.clientId);
      return { ok: true, mode: "enrolled", sentNow };
    }
    const sentNow = await dispatchCaseReferredNow(args.clientId);
    return { ok: true, mode: "reactivated", sentNow };
  }

  const enrolled = await enrollClientInEmailSequence(supabase, {
    clientId: args.clientId,
    sequenceKey: "case_referred",
    clientEmail: args.clientEmail,
  });
  if (!enrolled.ok) {
    return { ok: false, reason: enrolled.reason };
  }
  const sentNow = await dispatchCaseReferredNow(args.clientId);
  return { ok: true, mode: "enrolled", sentNow };
}
