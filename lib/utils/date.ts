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

/** Long label with weekday and short zone (e.g. FedEx batch deadline). */
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

const LA_WEEKDAY_TO_NUM: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function readLaWallClock(now: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  laDay: number;
} {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
    hourCycle: "h23",
  });
  const p = f.formatToParts(now);
  const g = (t: Intl.DateTimeFormatPartTypes) =>
    p.find((x) => x.type === t)?.value ?? "";
  const wdStr = g("weekday");
  return {
    year: parseInt(g("year"), 10),
    month: parseInt(g("month"), 10),
    day: parseInt(g("day"), 10),
    hour: parseInt(g("hour"), 10),
    minute: parseInt(g("minute"), 10),
    laDay: LA_WEEKDAY_TO_NUM[wdStr] ?? 0,
  };
}

/** Gregorian calendar Y-M-D plus `addDays`, using UTC date math (same as Date.UTC rollover). */
function addCalendarDaysUtc(
  year: number,
  month: number,
  day: number,
  addDays: number
): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(year, month - 1, day + addDays, 12, 0, 0, 0));
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
  };
}

/** First UTC instant where LA wall is Y-M-D at hour:minute:00 (within ±72h of noon UTC anchor). */
function utcInstantForLaWall(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const anchor = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const read = (d: Date) => {
    const parts = fmt.formatToParts(d);
    const g = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((x) => x.type === t)?.value ?? "";
    return {
      y: parseInt(g("year"), 10),
      mo: parseInt(g("month"), 10),
      d: parseInt(g("day"), 10),
      h: parseInt(g("hour"), 10),
      mi: parseInt(g("minute"), 10),
      s: parseInt(g("second"), 10),
    };
  };
  for (let offset = -72 * 3600000; offset <= 72 * 3600000; offset += 60000) {
    const d = new Date(anchor + offset);
    const r = read(d);
    if (
      r.y === year &&
      r.mo === month &&
      r.d === day &&
      r.h === hour &&
      r.mi === minute &&
      r.s === 0
    ) {
      return d;
    }
  }
  return new Date(anchor);
}

/**
 * Next Sunday or Wednesday at 8:00 PM America/Los_Angeles, strictly after `now`
 * (default: current instant). Uses the Sun/Wed + 8PM cutoff calendar rules.
 */
export function getNextFedexBatchDeadline(now: Date = new Date()): Date {
  const startMs = now.getTime();
  const { year, month, day, hour, minute, laDay } = readLaWallClock(now);
  const currentMinutes = hour * 60 + minute;
  const cutoffMinutes = 20 * 60;

  const batchDays = [0, 3];
  let bestDiff = 8;

  for (const batchDay of batchDays) {
    let diff = batchDay - laDay;
    if (diff < 0) diff += 7;

    if (diff === 0) {
      if (currentMinutes < cutoffMinutes) {
        bestDiff = 0;
        break;
      }
      diff = 7;
    }

    if (diff < bestDiff) bestDiff = diff;
  }

  const { y: ty, m: tm, d: td } = addCalendarDaysUtc(year, month, day, bestDiff);
  let deadline = utcInstantForLaWall(ty, tm, td, 20, 0);

  if (deadline.getTime() <= startMs) {
    for (let m = 1; m < 8 * 24 * 60; m++) {
      const d = new Date(startMs + m * 60000);
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: LA_TZ,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        hourCycle: "h23",
      }).formatToParts(d);
      const g = (t: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === t)?.value ?? "";
      const wd = g("weekday");
      const h = parseInt(g("hour"), 10);
      const mi = parseInt(g("minute"), 10);
      const s = parseInt(g("second"), 10);
      const isBatchDay = wd === "Sun" || wd === "Wed";
      if (isBatchDay && h === 20 && mi === 0 && s <= 1) {
        deadline = d;
        break;
      }
    }
  }

  return deadline;
}

/**
 * Next Sun/Wed batch calendar date in America/Los_Angeles, strictly after today
 * (never today). Returns YYYY-MM-DD for batch_id / batch_date persistence.
 */
export function getNextFedexBatchDateIso(now: Date = new Date()): string {
  const { year, month, day, laDay } = readLaWallClock(now);
  const daysUntilSunday = (7 - laDay) % 7 || 7;
  const daysUntilWednesday = (3 - laDay + 7) % 7 || 7;
  const daysUntilNext = Math.min(daysUntilSunday, daysUntilWednesday);
  const { y, m, d } = addCalendarDaysUtc(year, month, day, daysUntilNext);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** MM/DD/YYYY display label + YYYY-MM-DD batch_id for the next FedEx batch queue. */
export function formatFedexBatchFromDeadline(now: Date = new Date()): {
  batchDateLabel: string;
  batchDateIso: string;
  batchId: string;
} {
  const batchDateIso = getNextFedexBatchDateIso(now);
  const batchId = batchDateIso;
  const [isoY, isoM, isoD] = batchDateIso.split("-");
  const batchDateLabel = `${isoM}/${isoD}/${isoY}`;
  return { batchDateLabel, batchDateIso, batchId };
}

/** Short label + `Hh Mm` countdown for the next Sun/Wed 8PM LA batch (FedEx manager UI). */
export function getNextFedexBatchCountdownLabel(now: Date = new Date()): {
  label: string;
  countdown: string;
} {
  const deadline = getNextFedexBatchDeadline(now);
  const diffMs = Math.max(0, deadline.getTime() - now.getTime());
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  const secs = Math.floor((diffMs % 60_000) / 1000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  parts.push(`${String(secs).padStart(2, "0")}s`);
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(deadline);
  return { label, countdown: parts.join(" ") };
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
