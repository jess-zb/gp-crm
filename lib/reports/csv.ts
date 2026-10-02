/** Escape a single CSV field (RFC-style). */
export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function rowToCsvLine(cells: string[]): string {
  return cells.map(csvEscape).join(",");
}
