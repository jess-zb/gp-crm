"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { canAccessRefundQueue } from "@/lib/roles";
import { formatMoneyUsdFromCents } from "@/lib/utils/format";

export type RefundActionResult = { ok: true } | { ok: false; error: string };

/**
 * Settling a refund is dev/admin only, re-checked here rather than relying on
 * the hidden Refunds tab.
 */
async function requireRefundQueueAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  if (!canAccessRefundQueue(profile.role)) {
    return { ok: false as const, error: "Not authorized." };
  }

  return {
    ok: true as const,
    supabase,
    actorId: user.id,
    actorName: profile.full_name?.trim() || profile.email || "Unknown",
  };
}

export async function markRefundRefunded(refundId: string): Promise<RefundActionResult> {
  const auth = await requireRefundQueueAccess();
  if (!auth.ok) return { ok: false, error: auth.error };

  const now = new Date().toISOString();

  const { data: updated, error } = await auth.supabase
    .from("refunds")
    .update({
      status: "refunded",
      refunded_at: now,
      refunded_by: auth.actorId,
      refunded_by_name: auth.actorName,
      // The amount and processor have now been seen by a person.
      needs_review: false,
    })
    .eq("id", refundId)
    .eq("status", "requested")
    .select("client_id, amount_cents, processor_mid")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!updated) {
    return { ok: false, error: "That refund is no longer pending." };
  }

  const { error: auditErr } = await auth.supabase.from("audit_log").insert({
    client_id: updated.client_id as string,
    action: "refund_processed",
    new_value: {
      refund_id: refundId,
      amount: formatMoneyUsdFromCents(updated.amount_cents as number | null),
      processor_mid: updated.processor_mid as string | null,
      refunded_at: now,
    },
    performed_by: auth.actorId,
    performed_by_name: auth.actorName,
  });
  if (auditErr) {
    console.error("[markRefundRefunded] audit", auditErr.message);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${updated.client_id as string}`);
  return { ok: true };
}

/**
 * Records the same-day billing used to keep a large refund inside the processor
 * float. Advisory bookkeeping only — it does not gate anything.
 */
export async function recordRefundOffsetBilling(
  refundId: string,
  billed: boolean,
  offsetAmountCents?: number
): Promise<RefundActionResult> {
  const auth = await requireRefundQueueAccess();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (billed && offsetAmountCents !== undefined && offsetAmountCents < 0) {
    return { ok: false, error: "Offset amount cannot be negative." };
  }

  const { data: updated, error } = await auth.supabase
    .from("refunds")
    .update(
      billed
        ? {
            offset_billed_at: new Date().toISOString(),
            offset_amount_cents: offsetAmountCents ?? null,
          }
        : { offset_billed_at: null, offset_amount_cents: null }
    )
    .eq("id", refundId)
    .select("client_id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "Refund not found." };

  revalidatePath("/clients");
  return { ok: true };
}

export async function markRefundDenied(refundId: string): Promise<RefundActionResult> {
  const auth = await requireRefundQueueAccess();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data: updated, error } = await auth.supabase
    .from("refunds")
    .update({ status: "denied" })
    .eq("id", refundId)
    .eq("status", "requested")
    .select("client_id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "That refund is no longer pending." };

  revalidatePath("/clients");
  return { ok: true };
}
