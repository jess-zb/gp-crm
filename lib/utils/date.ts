export const LA_TZ = "America/Los_Angeles";

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: LA_TZ,
    ...options,
  });
}

/** Safe `formatDateTime` for nullable ISO strings (tables, sidebars). */
export function formatDateTimeOrDash(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateTime(d);
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    timeZone: LA_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** e.g. `04/30/26 3:24 PM` in America/Los_Angeles (compact for sidebars). */
export function formatShortDateTime(date: string | Date): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d
    .toLocaleString("en-US", {
      timeZone: LA_TZ,
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", "");
}

/** Long label with weekday and short zone. */
export function formatDateTimeLong(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    timeZone: LA_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    timeZone: LA_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** e.g. "Jan 5 at 3:00 PM" (LA) — for activity log style. */
export function formatDateTimeAtWord(date: string | Date): string {
  const d = new Date(date);
  const datePart = d.toLocaleDateString("en-US", {
    timeZone: LA_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${datePart} at ${formatTime(d)}`;
}

/** e.g. "Jan 5, 3:00 PM" without year (LA). */
export function formatShortMonthDayTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    timeZone: LA_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

/** YYYY-MM-DD in LA (for grouping / comparisons). */
export function laCalendarDayKey(date: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

/** Current time in LA as `HH:mm` (24h), for datetime-local style defaults. */
export function laNowHm24(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}
