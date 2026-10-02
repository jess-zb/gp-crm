import { MERCHANT_OPTIONS } from "@/lib/constants/merchants";

/**
 * Built-in merchant/MID list only. Prefer `useMerchantOptions()` (client) or
 * `loadMerchantOptions()` (server) so Dev-added extras from crm_settings are
 * included and A–Z sorted with the rest of the CRM pickers.
 */
export const PROCESSOR_MID_OPTIONS = MERCHANT_OPTIONS;

/**
 * Processors sweep everything above this to the operating account at end of day.
 * A refund larger than what is left behind means the company eats a fee unless
 * someone is billed on the same MID that day.
 *
 * Same threshold for every processor, and advisory only — it never blocks
 * recording a refund.
 */
export const PROCESSOR_FLOAT_CENTS = 1_000_000;

export const REFUND_STATUSES = ["requested", "refunded", "denied"] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export function isRefundStatus(value: string): value is RefundStatus {
  return (REFUND_STATUSES as readonly string[]).includes(value);
}

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  requested: "Requested",
  refunded: "Refunded",
  denied: "Denied",
};

/** Falls back to a readable placeholder so grouping never keys on an empty string. */
export const UNKNOWN_PROCESSOR_LABEL = "Unassigned MID";

export function processorLabel(mid: string | null | undefined): string {
  const trimmed = (mid ?? "").trim();
  return trimmed || UNKNOWN_PROCESSOR_LABEL;
}
