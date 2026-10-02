import type { EsignKind } from "./types";
import type { EsignClientPrefill } from "./map-client-prefill";
import { signerDisplayName } from "./map-client-prefill";
import { formatUsd, isAmountField } from "./money";

export const ESIGN_BIND_KEYS = [
  "fullName",
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
  if (bind.endsWith("Amount") || bind === "signedDate") {
    return { wPct: 16, hPct: 2.1 };
  }
  if (bind === "mid") return { wPct: 36, hPct: 2.2 };
  return { wPct: 32, hPct: 2.2 };
}

function box(
  id: string,
  bind: EsignBindKey,
  page: number,
  x: number,
  yTop: number,
  w: number,
  h: number,
  pageW: number,
  pageH: number
): EsignLayoutField {
  return {
    id,
    bind,
    page,
    xPct: (x / pageW) * 100,
    yPct: (yTop / pageH) * 100,
    wPct: (w / pageW) * 100,
    hPct: (h / pageH) * 100,
  };
}

const CC_W = 595.28;
const CC_H = 841.89;
const WP_W = 612;
const WP_H = 792;

export function defaultLayoutForKind(kind: EsignKind): EsignLayoutField[] {
  if (kind === "welcome_packet") {
    return [
      box("wp-name-0", "fullName", 0, 110, 179, 230, 16, WP_W, WP_H),
      box("wp-am-0", "advisor", 0, 130, 256.5, 160, 16, WP_W, WP_H),
      box("wp-mid-0", "mid", 0, 205, 426.5, 160, 16, WP_W, WP_H),
      box("wp-name-1a", "fullName", 1, 300, 227.5, 210, 16, WP_W, WP_H),
      box("wp-name-1b", "fullName", 1, 210, 551, 180, 16, WP_W, WP_H),
      box("wp-sig-1", "signature", 1, 180, 548, 250, 22, WP_W, WP_H),
      box("wp-date-1", "signedDate", 1, 180, 582, 140, 16, WP_W, WP_H),
      box("wp-name-2a", "fullName", 2, 350, 273.5, 200, 16, WP_W, WP_H),
      box("wp-name-2b", "fullName", 2, 160, 563.5, 220, 16, WP_W, WP_H),
      box("wp-sig-2", "signature", 2, 175, 557, 250, 22, WP_W, WP_H),
      box("wp-date-2", "signedDate", 2, 180, 594.5, 140, 16, WP_W, WP_H),
      box("wp-name-3a", "fullName", 3, 80, 221.5, 280, 16, WP_W, WP_H),
      box("wp-name-3b", "fullName", 3, 170, 613, 220, 16, WP_W, WP_H),
      box("wp-sig-3", "signature", 3, 145, 606, 280, 22, WP_W, WP_H),
      box("wp-date-3", "signedDate", 3, 110, 644, 140, 16, WP_W, WP_H),
      box("wp-name-4", "fullName", 4, 160, 539, 220, 16, WP_W, WP_H),
      box("wp-sig-4", "signature", 4, 140, 533, 280, 22, WP_W, WP_H),
      box("wp-date-4", "signedDate", 4, 100, 570.5, 140, 16, WP_W, WP_H),
    ];
  }
  return [
    box("cc-amt", "amountAuthorized", 0, 185, 292.5, 180, 16, CC_W, CC_H),
    box("cc-c1-4", "card1Last4", 0, 155, 321, 70, 16, CC_W, CC_H),
    box("cc-c1-a", "card1Amount", 0, 288, 341.5, 90, 16, CC_W, CC_H),
    box("cc-c2-4", "card2Last4", 0, 155, 350.4, 70, 16, CC_W, CC_H),
    box("cc-c2-a", "card2Amount", 0, 288, 371, 90, 16, CC_W, CC_H),
    box("cc-mid", "mid", 0, 62, 514, 280, 16, CC_W, CC_H),
    box("cc-sig", "signature", 0, 185, 638, 340, 36, CC_W, CC_H),
    box("cc-name", "fullName", 0, 148, 688.5, 360, 16, CC_W, CC_H),
    box("cc-date", "signedDate", 0, 100, 724, 180, 16, CC_W, CC_H),
  ];
}

export function valueForBind(
  bind: EsignBindKey,
  prefill: EsignClientPrefill,
  signedDate: string
): string {
  if (bind === "fullName") return signerDisplayName(prefill);
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
