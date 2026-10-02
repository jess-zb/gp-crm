/**
 * Dev kill switch for PostLogic / printer dispatch.
 * Cron GET and staff/dev send routes must honor this before calling the printer.
 *
 * Missing or anything other than "true" = paused (fail-safe while docs are pending).
 */
export const FEDEX_PRINT_BATCH_ENABLED_KEY = "fedex_print_batch_enabled";

export const PRINT_BATCH_PAUSED_MESSAGE =
  "Printer dispatch is paused. Turn it back on from Packet Manager (Dev) to send.";

export function isFedexPrintBatchEnabled(
  value: string | null | undefined
): boolean {
  return value === "true";
}

/**
 * Accept a loose client. Passing a fully typed SupabaseClient into a
 * structural `from()` signature overflows TypeScript ("excessively deep").
 */
export async function fetchFedexPrintBatchEnabled(supabase: {
  from: (table: string) => any;
}): Promise<boolean> {
  const { data, error } = await supabase
    .from("crm_settings")
    .select("value")
    .eq("key", FEDEX_PRINT_BATCH_ENABLED_KEY)
    .maybeSingle();
  if (error) {
    console.error("[print-batch-setting] load error:", error.message);
    return false;
  }
  return isFedexPrintBatchEnabled(data?.value as string | null | undefined);
}
