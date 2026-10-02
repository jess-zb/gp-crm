import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalizeMerchantName } from "@/lib/constants/merchants";

/** Tier 1: majority merchant from client_cards. Returns null if no cards. */
async function resolveFromCards(clientId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_cards")
    .select("merchant_name")
    .eq("client_id", clientId)
    .not("merchant_name", "is", null);

  const cards = data as { merchant_name: string | null }[] | null;
  if (!cards || !cards.length) return null;

  const counts = new Map<string, number>();
  for (const row of cards) {
    const m = row.merchant_name?.trim();
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  Array.from(counts.entries()).forEach(([merchant, count]) => {
    if (count > bestCount) {
      best = merchant;
      bestCount = count;
    }
  });
  return best;
}

/**
 * Tier 2: exact first+last match in sunset_lookup, with last-name-only nickname fallback.
 * Nickname fallback only fires when exactly one row shares the last name.
 */
async function resolveFromSunset(
  firstName: string | null,
  lastName: string | null
): Promise<string | null> {
  if (!lastName?.trim()) return null;
  const supabase = createAdminClient();

  if (firstName?.trim()) {
    const key = `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
    const { data } = await supabase
      .from("sunset_lookup")
      .select("merchant")
      .eq("name_key", key)
      .maybeSingle();
    const row = data as { merchant: string | null } | null;
    if (row?.merchant) return row.merchant;
  }

  // Last-name-only fallback (nickname match) — only when unambiguous
  const lastLower = lastName.trim().toLowerCase();
  const { data } = await supabase
    .from("sunset_lookup")
    .select("merchant")
    .like("name_key", `%|${lastLower}`);

  const rows = data as { merchant: string | null }[] | null;
  if (rows?.length === 1) return rows[0].merchant;
  return null;
}

export async function resolveFedexMerchant(
  clientId: string,
  firstName: string | null,
  lastName: string | null
): Promise<string | null> {
  const tier1 = await resolveFromCards(clientId);
  if (tier1) return canonicalizeMerchantName(tier1) || null;
  const sunset = await resolveFromSunset(firstName, lastName);
  return sunset ? canonicalizeMerchantName(sunset) || null : null;
}

/**
 * Resolve and persist to clients.fedex_merchant.
 * Does NOT push to the PDF generator — that happens only at batch send time
 * so PostLogic and PDF receive the same Packets Needed Date Created order.
 */
export async function autoMatchAndSaveMerchant(
  clientId: string,
  firstName: string | null,
  lastName: string | null
): Promise<string | null> {
  const merchant = await resolveFedexMerchant(clientId, firstName, lastName);
  if (!merchant) return null;

  const supabase = createAdminClient();

  await supabase
    .from("clients")
    .update({ fedex_merchant: merchant })
    .eq("id", clientId);

  return merchant;
}
