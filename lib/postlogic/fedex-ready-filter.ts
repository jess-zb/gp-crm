/**
 * FedEx batch "ready to send" eligibility (queued for print partner).
 *
 * Matches clients where:
 * - stage = welcome_packet (packet not yet superseded by later pipeline moves)
 * - delivery_method = fedex, is_active, no postlogic id yet, batch not sent
 * - AND fedex_queued_at is set
 * - AND stage is not cancelled / closed pipeline exits
 */
export const FEDEX_READY_OR_FILTER = "fedex_queued_at.not.is.null";

/**
 * Terminal / cancelled pipeline stages that must never enter Packets Needed
 * or a FedEx batch send — including when a Pending "Resend via FedEx" marker exists.
 * Keep this list as the single source of truth for UI queue + batch eligibility.
 */
export const FEDEX_BATCH_EXCLUDED_STAGES = [
  "retention",
  "dnc",
  "not_interested",
  "dnq",
  "mortgage",
  "closed",
] as const;

export const FEDEX_BATCH_EXCLUDED_STAGE_SET = new Set<string>(
  FEDEX_BATCH_EXCLUDED_STAGES
);

/** PostgREST `.not('stage','in', ...)` value — cancelled clients must not ship in batch. */
export const FEDEX_BATCH_EXCLUDED_STAGES_IN = `("${FEDEX_BATCH_EXCLUDED_STAGES.join(
  '","'
)}")`;

/** Apply to a `clients` query before `.select()` / ordering. */
export function applyFedexReadyToSendFilters<
  Q extends {
    eq(column: string, value: unknown): Q;
    is(column: string, value: null): Q;
    or(filters: string): Q;
    not(column: string, operator: string, pattern: string): Q;
  },
>(q: Q): Q {
  return q
    .eq("stage", "welcome_packet")
    .eq("delivery_method", "fedex")
    .eq("is_active", true)
    .is("postlogic_unique_id", null)
    .is("fedex_batch_sent_at", null)
    .is("batch_id", null)
    .or(FEDEX_READY_OR_FILTER)
    .not("stage", "in", FEDEX_BATCH_EXCLUDED_STAGES_IN);
}
