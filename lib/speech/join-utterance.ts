/** Join a new speech chunk onto existing note text without double spaces. */
export function joinUtterance(base: string, next: string): string {
  const chunk = next.replace(/\s+/g, " ").trim();
  if (!chunk) return base;
  if (!base) return chunk;
  if (/^[.,!?;:]/.test(chunk)) return `${base}${chunk}`;
  if (/\s$/.test(base)) return `${base}${chunk}`;
  return `${base} ${chunk}`;
}
