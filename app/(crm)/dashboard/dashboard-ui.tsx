export function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function clientDisplayName(client: {
  first_name: string | null;
  last_name: string | null;
}): string {
  return [client.first_name, client.last_name].filter(Boolean).join(" ") || "Client";
}

export function daysInStage(iso?: string | null): number | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return Number.isFinite(days) ? Math.max(0, days) : null;
}

export function countAppointmentsOn(rows: { due_date: string | null }[], day = new Date()): number {
  return rows.filter((row) => {
    if (!row.due_date) return false;
    const value = new Date(row.due_date);
    return (
      value.getFullYear() === day.getFullYear() &&
      value.getMonth() === day.getMonth() &&
      value.getDate() === day.getDate()
    );
  }).length;
}
