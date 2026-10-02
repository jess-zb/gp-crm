import type { SupabaseClient } from "@supabase/supabase-js";

/** Pacific calendar date string for the current send batch (YYYY-MM-DD). */
export function getTodayBatchId(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

/**
 * Distinct `batch_id` values, newest first (relies on rows ordered by `batch_id` desc
 * so duplicate ids are adjacent for a single-pass dedupe).
 */
export async function getDistinctBatchIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("batch_id")
    .not("batch_id", "is", null)
    .order("batch_id", { ascending: false });

  if (error || !data?.length) return [];

  const unique: string[] = [];
  let prev = "";
  for (const row of data) {
    const b = (row.batch_id as string | null)?.trim() ?? "";
    if (!b || b === prev) continue;
    unique.push(b);
    prev = b;
  }
  return unique;
}

/** Client columns shared by FedEx Batch Manager tabs + embed. */
export const FEDEX_CLIENT_SELECT = [
  "id",
  "first_name",
  "last_name",
  "phone_mobile",
  "street_address",
  "city",
  "state",
  "zip_code",
  "fedex_tracking_number",
  "fedex_queued_at",
  "fedex_batch_sent_at",
  "batch_id",
  "postlogic_status",
  "postlogic_unique_id",
  "pod_delivered_at",
  "stage",
  "assigned_to",
  "assigned_user:assigned_to(full_name)",
].join(",");
