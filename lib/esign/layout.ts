import type { EsignClientPrefill } from "./map-client-prefill";
import {
  formatCityStateZip,
  formatFullAddress,
  signerDisplayName,
} from "./map-client-prefill";
import { formatUsd, isAmountField } from "./money";

export const ESIGN_BIND_KEYS = [
  "fullName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "street",
  "city",
  "state",
  "zip",
  "cityStateZip",
  "dateOfBirth",
  "spouseName",
  "advisor",
  "mid",
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
  "signedDate",
  "signature",
] as const;

export type EsignBindKey = (typeof ESIGN_BIND_KEYS)[number];

export type EsignLayoutField = {
  id: string;
  bind: EsignBindKey;
  page: number;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
};

export const BIND_LABELS: Record<EsignBindKey, string> = {
  fullName: "Name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  street: "Street",
  city: "City",
  state: "State",
  zip: "ZIP",
  cityStateZip: "City, State, ZIP",
  dateOfBirth: "Date of birth",
  spouseName: "Spouse",
  advisor: "Account Manager",
  mid: "MID",
  amountAuthorized: "Amount authorized",
  card1Last4: "Card 1 last 4",
  card1Amount: "Card 1 amount",
  card2Last4: "Card 2 last 4",
  card2Amount: "Card 2 amount",
  card3Last4: "Card 3 last 4",
  card3Amount: "Card 3 amount",
  card4Last4: "Card 4 last 4",
  card4Amount: "Card 4 amount",
  card5Last4: "Card 5 last 4",
  card5Amount: "Card 5 amount",
  signedDate: "Date",
  signature: "Signature",
};

export function isEsignBindKey(value: string): value is EsignBindKey {
  return (ESIGN_BIND_KEYS as readonly string[]).includes(value);
}

export function defaultSizeForBind(bind: EsignBindKey): { wPct: number; hPct: number } {
  if (bind === "signature") return { wPct: 40, hPct: 2.8 };
  if (bind.endsWith("Last4")) return { wPct: 12, hPct: 2.1 };
  if (bind === "state") return { wPct: 10, hPct: 2.1 };
  if (bind === "zip") return { wPct: 14, hPct: 2.1 };
  if (bind.endsWith("Amount") || bind === "signedDate" || bind === "dateOfBirth") {
    return { wPct: 16, hPct: 2.1 };
  }
  if (bind === "phone") return { wPct: 22, hPct: 2.2 };
  if (bind === "city") return { wPct: 18, hPct: 2.2 };
  if (bind === "address" || bind === "cityStateZip" || bind === "email") {
    return { wPct: 42, hPct: 2.2 };
  }
  if (bind === "street") return { wPct: 40, hPct: 2.2 };
  if (bind === "mid") return { wPct: 36, hPct: 2.2 };
  return { wPct: 32, hPct: 2.2 };
}

export function valueForBind(
  bind: EsignBindKey,
  prefill: EsignClientPrefill,
  signedDate: string
): string {
  if (bind === "fullName") return signerDisplayName(prefill);
  if (bind === "firstName") return prefill.firstName;
  if (bind === "lastName") return prefill.lastName;
  if (bind === "address") return prefill.address.trim() || formatFullAddress(prefill);
  if (bind === "cityStateZip") return prefill.cityStateZip.trim() || formatCityStateZip(prefill);
  if (bind === "signedDate") return signedDate;
  if (bind === "signature") return "";
  const raw = String((prefill as Record<string, string>)[bind] ?? "").trim();
  if (isAmountField(bind)) return formatUsd(raw);
  return raw;
}

export function parseLayoutFields(raw: unknown): EsignLayoutField[] | null {
  if (!Array.isArray(raw)) return null;
  const out: EsignLayoutField[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const bind = String(r.bind ?? "");
    if (!isEsignBindKey(bind)) continue;
    const id = String(r.id ?? "").trim() || crypto.randomUUID();
    out.push({
      id,
      bind,
      page: Math.max(0, Number(r.page) || 0),
      xPct: Number(r.xPct) || 0,
      yPct: Number(r.yPct) || 0,
      wPct: Number(r.wPct) || defaultSizeForBind(bind).wPct,
      hPct: Number(r.hPct) || defaultSizeForBind(bind).hPct,
    });
  }
  return out;
}
