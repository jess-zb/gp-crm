import type { EsignClientPrefill } from "./map-client-prefill";
import { signerDisplayName } from "./map-client-prefill";
import { formatUsd, isAmountField, parseUsdNumber } from "./money";
import { BIND_LABELS, isEsignBindKey, parseLayoutFields, type EsignBindKey } from "./layout";
import type { EsignTemplateRow } from "./types";

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
  key: EsignBindKey;
  label: string;
  kind: "text" | "mid" | "advisor" | "amount";
  group: "top" | "card";
  required: boolean;
};

const CARD_BIND = /^card[1-5](Last4|Amount)$/;

function kindForBind(bind: EsignBindKey): PrefillReviewField["kind"] {
  if (bind === "mid") return "mid";
  if (bind === "advisor") return "advisor";
  if (isAmountField(bind)) return "amount";
  return "text";
}

/**
 * The review form is derived from the fields staff placed on the template, so a
 * brand-new document gets a correct Confirm Before Sending step with no code
 * change. `signature` is collected from the signer, never from staff.
 */
export function reviewFieldsForTemplate(
  template: Pick<EsignTemplateRow, "fields" | "required_binds">
): PrefillReviewField[] {
  const placed = parseLayoutFields(template.fields) ?? [];
  const required = new Set(
    (template.required_binds ?? []).filter((b) => isEsignBindKey(b))
  );

  const seen = new Set<EsignBindKey>();
  const out: PrefillReviewField[] = [];
  for (const field of placed) {
    if (field.bind === "signature" || field.bind === "signedDate") continue;
    if (seen.has(field.bind)) continue;
    seen.add(field.bind);
    out.push({
      key: field.bind,
      label: BIND_LABELS[field.bind],
      kind: kindForBind(field.bind),
      group: CARD_BIND.test(field.bind) ? "card" : "top",
      required: required.has(field.bind),
    });
  }

  // Stable order: identity first, then money, then the card rows in sequence.
  const topOrder: EsignBindKey[] = ["fullName", "advisor", "mid", "amountAuthorized"];
  return out.sort((a, b) => {
    if (a.group !== b.group) return a.group === "top" ? -1 : 1;
    if (a.group === "top") {
      const ai = topOrder.indexOf(a.key);
      const bi = topOrder.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }
    return a.key.localeCompare(b.key);
  });
}

function reviewValueFilled(field: PrefillReviewField, raw: string): boolean {
  const value = String(raw ?? "").trim();
  if (!value) return false;
  if (/Last4$/.test(field.key)) {
    return /^\d{4}$/.test(value.replace(/\D/g, ""));
  }
  if (field.kind === "amount") return parseUsdNumber(value) != null;
  return true;
}

export function missingRequiredReviewFields(
  template: Pick<EsignTemplateRow, "fields" | "required_binds">,
  values: Record<string, string | undefined | null>
): PrefillReviewField[] {
  return reviewFieldsForTemplate(template).filter(
    (field) => field.required && !reviewValueFilled(field, String(values[field.key] ?? ""))
  );
}

/** Labels still empty after staff review — used by the send modal and the API. */
export function missingRequiredReviewLabels(
  template: Pick<EsignTemplateRow, "fields" | "required_binds">,
  values: Record<string, string | undefined | null>
): string[] {
  return missingRequiredReviewFields(template, values).map((f) => f.label);
}

export function reviewValuesFromPrefill(
  prefill: EsignClientPrefill
): Record<string, string> {
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
