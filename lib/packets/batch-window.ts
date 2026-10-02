/** Next batch send window: Sunday or Wednesday at 8:00 PM Pacific. */
export function getNextBatchDate(from: Date = new Date()): Date {
  const now = new Date(from);
  const day = now.getDay();
  const batchDays = [0, 3];

  let daysUntil = 0;
  for (let i = 1; i <= 7; i++) {
    if (batchDays.includes((day + i) % 7)) {
      daysUntil = i;
      break;
    }
  }

  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  next.setHours(20, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
    for (let i = 0; i < 7; i++) {
      const d = new Date(next);
      d.setDate(next.getDate() + i);
      if (batchDays.includes(d.getDay())) {
        d.setHours(20, 0, 0, 0);
        if (d.getTime() > now.getTime()) return d;
      }
    }
  }
  return next;
}

export function wasBatchSentWithinDays(
  latestBatchId: string | null,
  days: number
): boolean {
  if (!latestBatchId) return false;
  const batchDate = new Date(`${latestBatchId.trim()}T12:00:00`);
  if (Number.isNaN(batchDate.getTime())) return false;
  const diffMs = Date.now() - batchDate.getTime();
  return diffMs >= 0 && diffMs < days * 24 * 60 * 60 * 1000;
}

export function formatBatchCountdown(next: Date): string {
  const diff = next.getTime() - Date.now();
  if (diff <= 0) return "Ready to send!";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  parts.push(`${String(secs).padStart(2, "0")}s`);

  return parts.join(" ");
}
