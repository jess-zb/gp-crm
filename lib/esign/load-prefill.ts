import type { SupabaseClient } from "@supabase/supabase-js";
import { isHiddenFromRole } from "@/lib/constants/hidden-accounts";
import { midNameFromEmbed } from "@/lib/mids/queries";
import type { EsignClientPrefill } from "./map-client-prefill";
import { formatCityStateZip, formatFullAddress } from "./map-client-prefill";
import { formatUsd } from "./money";

export async function loadAdvisorOptions(
  admin: SupabaseClient,
  viewerRole: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("full_name, email, role, is_accounts, is_active")
    .eq("is_accounts", true)
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  let rows: { full_name: string | null; email: string | null }[] = data ?? [];
  if (error) {
    const fallback = await admin
      .from("profiles")
      .select("full_name, email, role")
      .eq("role", "acct_manager")
      .order("full_name", { ascending: true });
    rows = fallback.data ?? [];
  }
  const names = rows
    .filter((row) => !isHiddenFromRole(row.email as string | null, viewerRole))
    .map((row) => String(row.full_name ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(names));
}

function dollars(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents) || cents <= 0) return "";
  return formatUsd(String((cents / 100).toFixed(2)));
}

function formatDob(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US");
}

export function emptyPrefill(): EsignClientPrefill {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    dateOfBirth: "",
    spouseName: "",
    address: "",
    cityStateZip: "",
    advisor: "",
    mid: "",
    amountAuthorized: "",
    card1Last4: "",
    card1Amount: "",
    card2Last4: "",
    card2Amount: "",
    card3Last4: "",
    card3Amount: "",
    card4Last4: "",
    card4Amount: "",
    card5Last4: "",
    card5Amount: "",
  };
}

export async function loadEsignPrefill(
  admin: SupabaseClient,
  clientId: string
): Promise<EsignClientPrefill> {
  const out = emptyPrefill();
  const { data: client } = await admin
    .from("clients")
    .select(
      "first_name, last_name, nickname, email, phone_mobile, phone, street_address, city, state, zip_code, date_of_birth, spouse_name, spouse_first_name, spouse_last_name, assigned_to, mids(name)"
    )
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return out;

  out.firstName = String(client.first_name ?? "").trim();
  out.lastName = String(client.last_name ?? "").trim();
  if (!out.firstName && !out.lastName) {
    out.firstName = String(client.nickname ?? "").trim();
  }
  out.email = String(client.email ?? "").trim();
  out.phone = String(client.phone_mobile ?? client.phone ?? "").trim();
  out.street = String(client.street_address ?? "").trim();
  out.city = String(client.city ?? "").trim();
  out.state = String(client.state ?? "").trim();
  out.zip = String(client.zip_code ?? "").trim();
  out.dateOfBirth = formatDob(client.date_of_birth as string | null);
  out.address = formatFullAddress(out);
  out.cityStateZip = formatCityStateZip(out);
  out.spouseName =
    String(client.spouse_name ?? "").trim() ||
    `${String(client.spouse_first_name ?? "").trim()} ${String(client.spouse_last_name ?? "").trim()}`.trim();

  out.mid = midNameFromEmbed(client.mids) ?? "";

  if (client.assigned_to) {
    const { data: am } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", client.assigned_to)
      .maybeSingle();
    out.advisor = String(am?.full_name ?? "").trim();
  }

  const { data: cards } = await admin
    .from("client_cards")
    .select("last_four, charge_amount_cents, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(5);

  const rows = cards ?? [];
  const lastKeys = ["card1Last4", "card2Last4", "card3Last4", "card4Last4", "card5Last4"] as const;
  const amtKeys = ["card1Amount", "card2Amount", "card3Amount", "card4Amount", "card5Amount"] as const;
  let total = 0;
  rows.forEach((row, i) => {
    if (i > 4) return;
    out[lastKeys[i]] = String(row.last_four ?? "").trim();
    out[amtKeys[i]] = dollars(row.charge_amount_cents as number | null);
    total += Number(row.charge_amount_cents) || 0;
  });
  const listed = amtKeys.map((k) => out[k]).filter(Boolean);
  out.amountAuthorized = dollars(total) || listed.join(" + ");
  return out;
}

const OVERRIDE_KEYS: (keyof EsignClientPrefill)[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "street",
  "address",
  "city",
  "state",
  "zip",
  "cityStateZip",
  "dateOfBirth",
  "spouseName",
  "advisor",
  "amountAuthorized",
  "card1Last4",
  "card1Amount",
  "card2Last4",
  "card2Amount",
  "card3Last4",
  "card3Amount",
  "card4Last4",
  "card4Amount",
  "card5Last4",
  "card5Amount",
  "mid",
];

export function mergeSignerOverrides(
  prefill: EsignClientPrefill,
  overrides: (Partial<EsignClientPrefill> & { fullName?: string }) | null | undefined
): EsignClientPrefill {
  const next = { ...prefill };
  if (!overrides) return next;
  for (const key of OVERRIDE_KEYS) {
    const incoming = overrides[key];
    if (incoming !== undefined) next[key] = String(incoming ?? "").trim();
  }
  const full = String(overrides.fullName ?? "").trim();
  if (full) {
    const parts = full.split(/\s+/);
    next.firstName = parts[0] ?? full;
    next.lastName = parts.slice(1).join(" ");
  }
  return next;
}
