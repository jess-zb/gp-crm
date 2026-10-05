/** Keep a typed direct line. Group a plain 10-digit US number. */
export function normalizeDirectLine(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const rest = digits.slice(1);
    return `(${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
  }
  return trimmed;
}

export function staffNameWithDirectLine(
  name: string | null | undefined,
  directLine: string | null | undefined,
  fallback = ""
): string {
  const label = name?.trim() || fallback;
  const line = directLine?.trim() || "";
  if (!label) return line;
  if (!line) return label;
  return `${label} · ${line}`;
}
