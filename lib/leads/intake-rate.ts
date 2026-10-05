import type { SupabaseClient } from "@supabase/supabase-js";

export type IntakeRate = "ok" | "limited" | "unavailable";

/**
 * One locked counter for this route. A correct key can still only create
 * 60 leads a minute and 2,000 a day. A database error fails closed.
 */
export async function consumeLeadIntakeSlot(admin: SupabaseClient): Promise<IntakeRate> {
  const { data, error } = await admin.rpc("consume_lead_intake_slot");
  if (error) {
    console.error("[api/leads] rate:", error.message);
    return "unavailable";
  }
  return data === true ? "ok" : "limited";
}
