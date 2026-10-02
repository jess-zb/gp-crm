export const MERCHANT_OPTIONS = [
  "ADSM",
  "Advocate Pay",
  "Assurant",
  "Councel Pay",
  "Dune",
  "Esquire Bridge",
  "Golden Pathway",
  "Horizon",
  "Horizon International",
  "Juris Route",
  "New Life",
  "Pathly",
  "Premier Outlook",
  "Progressive",
  "Quantive",
  "Silver Lining Group",
  "Verita Pay",
  "Zero Consulting",
  "Other",
] as const;

/** Packet Manager curated subset (prefer mergeMerchantOptions for UI pickers). */
export const PACKET_MID_OPTIONS = [
  "Councel Pay",
  "Progressive",
  "Horizon",
  "Assurant",
  "ADSM",
  "Advocate Pay",
  "Esquire Bridge",
  "Golden Pathway",
  "Juris Route",
  "Verita Pay",
  "Zero Consulting",
  "New Life",
  "Premier Outlook",
] as const;

/**
 * crm_settings key — JSON string array of MID/merchant names added via the
 * Packet Manager Dev UI. Shared across Billing, Refunds, Packet Needed, and
 * eSign MID pickers.
 */
export const PACKET_MID_EXTRAS_SETTING_KEY = "packet_mid_extra_options";

function collapsedMerchantKey(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/**
 * Staff sometimes typed "Esquirebridge". Canonical display/storage name is
 * "Esquire Bridge".
 */
export function canonicalizeMerchantName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (collapsedMerchantKey(trimmed) === "esquirebridge") return "Esquire Bridge";
  const builtIn = MERCHANT_OPTIONS.find(
    (m) => m.toLowerCase() === trimmed.toLowerCase()
  );
  return builtIn ?? trimmed;
}

export function parsePacketMidExtras(
  value: string | null | undefined
): string[] {
  if (!value?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const name = canonicalizeMerchantName(item);
      if (!name) continue;
      if (isBuiltInMerchantOption(name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Built-in merchants plus crm_settings extras, A–Z (case-insensitive).
 * "Other" always sorts last when present.
 */
export function mergeMerchantOptions(extras: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [...MERCHANT_OPTIONS, ...extras]) {
    const name = canonicalizeMerchantName(m);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  const other: string[] = [];
  const rest: string[] = [];
  for (const name of out) {
    if (name.toLowerCase() === "other") other.push(name);
    else rest.push(name);
  }
  rest.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return [...rest, ...other];
}

/** @deprecated Prefer mergeMerchantOptions — same behavior. */
export function mergePacketMidOptions(extras: readonly string[]): string[] {
  return mergeMerchantOptions(extras);
}

export function isBuiltInMerchantOption(name: string): boolean {
  const key = canonicalizeMerchantName(name).toLowerCase();
  return MERCHANT_OPTIONS.some((m) => m.toLowerCase() === key);
}

type CrmSettingsQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string
    ) => {
      maybeSingle: () => Promise<{
        data: { value?: string | null } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

/** Load Dev-added MID extras from crm_settings (empty on error). */
export async function loadMerchantExtras(supabase: {
  from: (table: string) => unknown;
}): Promise<string[]> {
  const table = supabase.from("crm_settings") as CrmSettingsQuery;
  const { data, error } = await table
    .select("value")
    .eq("key", PACKET_MID_EXTRAS_SETTING_KEY)
    .maybeSingle();
  if (error) {
    console.error("[merchants] extras load error:", error.message);
    return [];
  }
  return parsePacketMidExtras(data?.value ?? null);
}

/** Full sorted MID/merchant list for any CRM picker. */
export async function loadMerchantOptions(supabase: {
  from: (table: string) => unknown;
}): Promise<string[]> {
  const extras = await loadMerchantExtras(supabase);
  return mergeMerchantOptions(extras);
}
