/** Amount fields: any bind/key/label containing "amount" (case-insensitive). */
export function isAmountField(key: string, label?: string): boolean {
  return /amount/i.test(key) || (label ? /amount/i.test(label) : false);
}

export function parseUsdNumber(raw: string): number | null {
  const cleaned = String(raw ?? "").replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Empty stays empty. Otherwise `$1,234.56` for the modal and PDF stamp. */
export function formatUsd(raw: string): string {
  const n = parseUsdNumber(raw);
  if (n == null) return "";
  const negative = n < 0;
  const abs = Math.abs(n);
  const [intPart, dec] = abs.toFixed(2).split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${withCommas}.${dec ?? "00"}`;
}

export function usdTypingValue(raw: string): string {
  return String(raw ?? "").replace(/[$,]/g, "").replace(/[^\d.]/g, "");
}

function groupThousands(intDigits: string): string {
  const digits = intDigits.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Amount shown in the $ input (no dollar sign). Live typing keeps commas; complete adds .00 */
export function formatUsdInput(raw: string, complete: boolean): string {
  if (complete) {
    const n = parseUsdNumber(raw);
    if (n == null) return "";
    const negative = n < 0;
    const abs = Math.abs(n);
    const [intPart, dec] = abs.toFixed(2).split(".");
    return `${negative ? "-" : ""}${groupThousands(intPart)}.${dec ?? "00"}`;
  }
  const typing = usdTypingValue(raw);
  if (!typing) return "";
  const endsDot = typing.endsWith(".");
  const [intPart, decPart] = typing.split(".");
  const grouped = groupThousands(intPart);
  if (endsDot && decPart === undefined) return `${grouped}.`;
  if (decPart !== undefined) return `${grouped}.${decPart.slice(0, 2)}`;
  return grouped;
}
