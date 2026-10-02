import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Legacy DB item string. The "Charge CC Information" step was retired from the
 * onboarding checklist when the Cards feature was hidden (F004). The constant is
 * kept so existing DB rows with this label can still be matched, but it is no
 * longer part of CHECKLIST_ITEM_LABELS, so new clients do not get this row.
 */
export const CHECKLIST_CHARGE_ITEM = "Charge CC Information";
export const CHECKLIST_POA_ITEM = "Signed POA Received";
export const CHECKLIST_COLLECTION_ITEM = "Collection Letter Received";

/** Legacy DB item strings — still matched when rendering rows. */
export const CHECKLIST_WELCOME_PACKET_ITEM_LEGACY = "Send Welcome Packet + POA";
export const CHECKLIST_WELCOME_PACKET_ITEM_LEGACY_ACCOUNT_MANAGER = "Send Account Manager";
export const CHECKLIST_WELCOME_PACKET_ITEM_LEGACY_SEND_TO = "Send to Account Manager";

export const CHECKLIST_WELCOME_PACKET_ITEM = "Send Welcome Packet";

export const CHECKLIST_WELCOME_PACKET_LEGACY_LABELS = [
  CHECKLIST_WELCOME_PACKET_ITEM_LEGACY,
  CHECKLIST_WELCOME_PACKET_ITEM_LEGACY_ACCOUNT_MANAGER,
  CHECKLIST_WELCOME_PACKET_ITEM_LEGACY_SEND_TO,
] as const;

export const CHECKLIST_ITEM_LABELS = [
  CHECKLIST_WELCOME_PACKET_ITEM,
  CHECKLIST_POA_ITEM,
  CHECKLIST_COLLECTION_ITEM,
] as const;

type ChecklistRowPick = { item: string };

export function findWelcomeChecklistRow<T extends ChecklistRowPick>(
  rows: T[]
): T | undefined {
  for (const legacy of CHECKLIST_WELCOME_PACKET_LEGACY_LABELS) {
    const hit = rows.find((r) => r.item === legacy);
    if (hit) return hit;
  }
  return rows.find((r) => r.item === CHECKLIST_WELCOME_PACKET_ITEM);
}

/**
 * Whether this client already has a row covering `item`, treating the
 * welcome-packet aliases as one step.
 *
 * Without the alias check, a client holding the legacy 'Send Welcome Packet +
 * POA' row looked like it was missing 'Send Welcome Packet', so a second row was
 * inserted for the same step. That is how 155 clients ended up with duplicate
 * welcome-packet rows.
 */
function hasChecklistItem(rows: ChecklistRowPick[], item: string): boolean {
  if (item === CHECKLIST_WELCOME_PACKET_ITEM) {
    return findWelcomeChecklistRow(rows) !== undefined;
  }
  return rows.some((r) => r.item === item);
}

/** Inserts any missing default onboarding rows for this client. */
export async function ensureChecklistItems(
  supabase: SupabaseClient,
  clientId: string
): Promise<void> {
  const { data: existing, error } = await supabase
    .from("onboarding_checklist")
    .select("item")
    .eq("client_id", clientId);

  if (error) return;

  const have: ChecklistRowPick[] = (existing ?? []).map((r) => ({
    item: r.item as string,
  }));

  for (const item of CHECKLIST_ITEM_LABELS) {
    if (hasChecklistItem(have, item)) continue;
    const { error: insErr } = await supabase
      .from("onboarding_checklist")
      .insert({ client_id: clientId, item });
    if (!insErr) have.push({ item });
  }
}
