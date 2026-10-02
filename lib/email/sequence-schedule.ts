/** When a step should send: enrolled_at + day_offset × 24h (matches dispatch / steps). */
export function enrollmentDueAtIso(enrolledAtIso: string, dayOffset: number): string {
  const ms = new Date(enrolledAtIso).getTime() + dayOffset * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}
