/** Dollar-string input to cents. Blank or unparsable reads as 0, never NaN. */
export function parseRefundAmountCents(raw: string): number {
  const n = Number.parseFloat((raw ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export type RefundPrefillCard = {
  charge_amount_cents?: number | null;
  merchant_name?: string | null;
};

export type RefundPrefill = {
  /** Sum of every charge on the client, as a starting point only. */
  amountCents: number;
  processorMid: string | null;
};

/**
 * Seeds the refund request fields from what the client was actually charged.
 * The MID is the merchant that appears on the most cards, matching how
 * resolveFedexMerchant picks one, with the persisted fedex_merchant as a
 * fallback when no card carries a merchant.
 *
 * Both values are editable in the modal — a partial refund on a different MID is
 * normal.
 */
export function refundPrefillFromCards(
  cards: RefundPrefillCard[],
  fallbackMerchant?: string | null
): RefundPrefill {
  let amountCents = 0;
  const counts = new Map<string, number>();

  for (const card of cards) {
    amountCents += Math.max(0, card.charge_amount_cents ?? 0);
    const merchant = card.merchant_name?.trim();
    if (merchant) counts.set(merchant, (counts.get(merchant) ?? 0) + 1);
  }

  let processorMid: string | null = null;
  let best = 0;
  Array.from(counts.entries()).forEach(([merchant, count]) => {
    if (count > best) {
      processorMid = merchant;
      best = count;
    }
  });

  return {
    amountCents,
    processorMid: processorMid ?? fallbackMerchant?.trim() ?? null,
  };
}
