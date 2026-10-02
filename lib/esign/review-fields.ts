import type { EsignKind } from "./types";
import type { EsignClientPrefill } from "./map-client-prefill";
import { signerDisplayName } from "./map-client-prefill";
import { formatUsd, isAmountField, parseUsdNumber } from "./money";

function firstNameOnly(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

/** Names on the PDF: "DAN ESIGN" / "marissa porter" → "Dan Esign" / "Marissa Porter". */
export function toTitleCaseName(raw: string): string {
  return String(raw ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part
            .split("'")
            .map((bit) =>
              bit ? bit.charAt(0).toUpperCase() + bit.slice(1).toLowerCase() : bit
            )
            .join("'")
        )
        .join("-")
    )
    .join(" ");
}

/** Account Manager stamps first name only, Title Case — "Marissa Porter" → "Marissa". */
export function formatAdvisorNameForEsign(raw: string): string {
  return toTitleCaseName(firstNameOnly(raw));
}

export type PrefillReviewField = {
  key: string;
  label: string;
  kind: "text" | "mid" | "advisor" | "amount";
  group?: "top" | "card";
  required?: boolean;
};

export function reviewFieldsForKind(kind: EsignKind): PrefillReviewField[] {
  if (kind === "welcome_packet") {
    return [
      { key: "fullName", label: "Name", kind: "text", group: "top" },
      { key: "advisor", label: "Account Manager", kind: "advisor", group: "top" },
      { key: "mid", label: "MID", kind: "mid", group: "top", required: true },
    ];
  }
  return [
    { key: "fullName", label: "Name", kind: "text", group: "top", required: true },
    { key: "advisor", label: "Account Manager", kind: "advisor", group: "top", required: true },
    { key: "mid", label: "MID", kind: "mid", group: "top", required: true },
    { key: "amountAuthorized", label: "Amount authorized", kind: "amount", group: "top" },
    { key: "card1Last4", label: "Card 1 last 4", kind: "text", group: "card", required: true },
    { key: "card1Amount", label: "Card 1 amount", kind: "amount", group: "card", required: true },
    { key: "card2Last4", label: "Card 2 last 4", kind: "text", group: "card" },
    { key: "card2Amount", label: "Card 2 amount", kind: "amount", group: "card" },
    { key: "card3Last4", label: "Card 3 last 4", kind: "text", group: "card" },
    { key: "card3Amount", label: "Card 3 amount", kind: "amount", group: "card" },
    { key: "card4Last4", label: "Card 4 last 4", kind: "text", group: "card" },
    { key: "card4Amount", label: "Card 4 amount", kind: "amount", group: "card" },
    { key: "card5Last4", label: "Card 5 last 4", kind: "text", group: "card" },
    { key: "card5Amount", label: "Card 5 amount", kind: "amount", group: "card" },
  ];
}

function reviewValueFilled(field: PrefillReviewField, raw: string): boolean {
  const value = String(raw ?? "").trim();
  if (!value) return false;
  if (/last\s*4/i.test(field.key) || /last 4/i.test(field.label)) {
    return /^\d{4}$/.test(value.replace(/\D/g, ""));
  }
  if (field.kind === "amount" || isAmountField(field.key, field.label)) {
    return parseUsdNumber(value) != null;
  }
  return true;
}

export function missingRequiredReviewFields(
  kind: EsignKind,
  values: Record<string, string | undefined | null>
): PrefillReviewField[] {
  return reviewFieldsForKind(kind).filter(
    (field) => field.required && !reviewValueFilled(field, String(values[field.key] ?? ""))
  );
}

/** Labels still empty after staff/signer review — used by the send modal and APIs. */
export function missingRequiredReviewLabels(
  kind: EsignKind,
  values: Record<string, string | undefined | null>
): string[] {
  return missingRequiredReviewFields(kind, values).map((field) => field.label);
}

export function reviewValuesFromPrefill(prefill: EsignClientPrefill): Record<string, string> {
  return {
    fullName: toTitleCaseName(signerDisplayName(prefill)),
    advisor: formatAdvisorNameForEsign(prefill.advisor),
    mid: prefill.mid,
    amountAuthorized: formatUsd(prefill.amountAuthorized),
    card1Last4: prefill.card1Last4,
    card1Amount: formatUsd(prefill.card1Amount),
    card2Last4: prefill.card2Last4,
    card2Amount: formatUsd(prefill.card2Amount),
    card3Last4: prefill.card3Last4,
    card3Amount: formatUsd(prefill.card3Amount),
    card4Last4: prefill.card4Last4,
    card4Amount: formatUsd(prefill.card4Amount),
    card5Last4: prefill.card5Last4,
    card5Amount: formatUsd(prefill.card5Amount),
  };
}

export function snapshotFromReview(
  values: Record<string, string>
): Partial<EsignClientPrefill> & { fullName?: string } {
  const fullName = toTitleCaseName(values.fullName ?? "");
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    fullName,
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    advisor: formatAdvisorNameForEsign(values.advisor ?? ""),
    mid: values.mid ?? "",
    amountAuthorized: formatUsd(values.amountAuthorized ?? ""),
    card1Last4: values.card1Last4 ?? "",
    card1Amount: formatUsd(values.card1Amount ?? ""),
    card2Last4: values.card2Last4 ?? "",
    card2Amount: formatUsd(values.card2Amount ?? ""),
    card3Last4: values.card3Last4 ?? "",
    card3Amount: formatUsd(values.card3Amount ?? ""),
    card4Last4: values.card4Last4 ?? "",
    card4Amount: formatUsd(values.card4Amount ?? ""),
    card5Last4: values.card5Last4 ?? "",
    card5Amount: formatUsd(values.card5Amount ?? ""),
  };
}
