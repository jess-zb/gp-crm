import type { SupabaseClient } from "@supabase/supabase-js";
import { runPendingFedexBatch } from "./run-pending-fedex-batch";

export async function runPostlogicSendBatch(
  supabase: SupabaseClient
): Promise<{ ok: true; count: number } | { ok: false; error: string; details?: unknown }> {
  console.log("[postlogic/send-batch] runPostlogicSendBatch start");
  const result = await runPendingFedexBatch(supabase);
  if (!result.ok) {
    console.error("[postlogic/send-batch] failed:", result.error);
    return { ok: false, error: result.error, details: result.details };
  }
  console.log("[postlogic/send-batch] success, count:", result.count, "skipped:", result.skipped);
  return { ok: true, count: result.count };
}
