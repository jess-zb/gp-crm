import { OFFICE_TZ } from "@/lib/time/office";
import { addCalendarDays, wallTimeToUtc, weekdayIndexForYmd } from "@/lib/time/zoned";

/** Today's calendar date in Arizona, `YYYY-MM-DD`. */
export function officeTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OFFICE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function officeDayStartIso(ymd: string): string | null {
  return wallTimeToUtc(ymd, "00:00", OFFICE_TZ)?.toISOString() ?? null;
}

/** Monday through Sunday of the Arizona week that contains `now`. */
export function officeWeekBounds(now = new Date()): { startIso: string; endIso: string; days: string[] } | null {
  const today = officeTodayYmd(now);
  const weekday = weekdayIndexForYmd(today, OFFICE_TZ);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = addCalendarDays(today, mondayOffset);
  const days = Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index));
  const start = wallTimeToUtc(days[0], "00:00", OFFICE_TZ);
  const nextMonday = wallTimeToUtc(addCalendarDays(days[6], 1), "00:00", OFFICE_TZ);
  if (!start || !nextMonday) return null;
  return {
    startIso: start.toISOString(),
    endIso: new Date(nextMonday.getTime() - 1).toISOString(),
    days,
  };
}

export function formatOfficeYmd(
  ymd: string,
  options: Intl.DateTimeFormatOptions
): string {
  const noon = wallTimeToUtc(ymd, "12:00", OFFICE_TZ);
  if (!noon) return ymd;
  return noon.toLocaleDateString("en-US", { timeZone: OFFICE_TZ, ...options });
}
