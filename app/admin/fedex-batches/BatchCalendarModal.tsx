"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Holidays from "date-holidays";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type DayInfo = {
  date: Date;
  inMonth: boolean;
  isCutoff: boolean;  // Sun or Wed — batch deadline night
  isShipDay: boolean; // Mon or Thu — FedEx picks up
  isHoliday: boolean;
  holidayName: string | null;
  isShipHoliday: boolean; // ship day falls on a holiday
  adjustedShip: Date | null;
  isToday: boolean;
};

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildDays(year: number, month: number): DayInfo[] {
  const hd = new Holidays("US");
  const todayStr = new Date().toDateString();

  function makeDay(date: Date, inMonth: boolean): DayInfo {
    const dow = date.getDay();
    const isCutoff = dow === 0 || dow === 3;
    const isShipDay = dow === 1 || dow === 4;

    const raw = hd.isHoliday(date);
    const pub = Array.isArray(raw) ? raw.find((h) => h.type === "public") : null;
    const isHoliday = !!pub;
    const holidayName = pub?.name ?? null;
    const isShipHoliday = isShipDay && isHoliday;

    let adjustedShip: Date | null = null;
    if (isShipHoliday) {
      let adj = new Date(date.getTime() + 86_400_000);
      for (let i = 0; i < 7; i++) {
        const adjDow = adj.getDay();
        const adjRaw = hd.isHoliday(adj);
        const adjPub = Array.isArray(adjRaw) ? adjRaw.find((h) => h.type === "public") : null;
        if (adjDow !== 0 && adjDow !== 6 && !adjPub) {
          adjustedShip = adj;
          break;
        }
        adj = new Date(adj.getTime() + 86_400_000);
      }
    }

    return {
      date,
      inMonth,
      isCutoff,
      isShipDay,
      isHoliday,
      holidayName,
      isShipHoliday,
      adjustedShip,
      isToday: date.toDateString() === todayStr,
    };
  }

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const cells: DayInfo[] = [];

  for (let i = first.getDay() - 1; i >= 0; i--) {
    cells.push(makeDay(new Date(year, month, -i), false));
  }
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(makeDay(new Date(year, month, d), true));
  }
  const endDow = last.getDay();
  if (endDow < 6) {
    for (let i = 1; i <= 6 - endDow; i++) {
      cells.push(makeDay(new Date(year, month + 1, i), false));
    }
  }

  return cells;
}

export function BatchCalendarModal({ onClose }: { onClose: () => void }) {
  const [{ year, month }, setYM] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const days = useMemo(() => buildDays(year, month), [year, month]);

  const prev = useCallback(() =>
    setYM(({ year: y, month: m }) =>
      m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 }
    ), []);

  const next = useCallback(() =>
    setYM(({ year: y, month: m }) =>
      m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 }
    ), []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#1a3550] dark:bg-[#071929]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-[#1a3550]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#0d2035]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[150px] text-center text-sm font-bold text-slate-900 dark:text-white">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              onClick={next}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#0d2035]"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#0d2035] dark:hover:text-slate-200"
            aria-label="Close calendar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* DOW header */}
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-[#1e3820]">
          {DOW_LABELS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-[#1e3820]">
          {days.map((day, i) => {
            const { inMonth, isCutoff, isShipDay, isHoliday, holidayName, isShipHoliday, adjustedShip, isToday, date } = day;

            let bg = "bg-white dark:bg-[#071929]";
            if (inMonth) {
              if (isShipHoliday) bg = "bg-amber-50 dark:bg-amber-950/25";
              else if (isCutoff) bg = "bg-emerald-50 dark:bg-emerald-950/25";
              else if (isShipDay) bg = "bg-sky-50 dark:bg-sky-950/25";
              else if (isHoliday) bg = "bg-amber-50/50 dark:bg-amber-950/10";
            }

            return (
              <div key={i} className={`flex min-h-[54px] flex-col p-1 ${bg}`}>
                {/* Day number */}
                <div className="flex justify-end">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium leading-none ${
                      isToday
                        ? "bg-[#8DE3B5] font-bold text-[#0A2540]"
                        : inMonth
                        ? "text-slate-800 dark:text-slate-200"
                        : "text-slate-300 dark:text-slate-700"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>

                {/* Labels */}
                {inMonth && (
                  <div className="mt-auto space-y-0.5">
                    {isCutoff && (
                      <div className="truncate text-[8.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Cutoff
                      </div>
                    )}
                    {isShipHoliday ? (
                      <>
                        <div className="truncate text-[8.5px] font-semibold text-amber-600 line-through dark:text-amber-400">
                          Ships
                        </div>
                        {adjustedShip && (
                          <div className="truncate text-[8px] font-medium text-amber-700 dark:text-amber-300">
                            →{fmtShort(adjustedShip)}
                          </div>
                        )}
                        {holidayName && (
                          <div className="truncate text-[7.5px] text-amber-500 dark:text-amber-500">
                            {holidayName}
                          </div>
                        )}
                      </>
                    ) : isShipDay ? (
                      <div className="truncate text-[8.5px] font-semibold text-sky-600 dark:text-sky-400">
                        Ships
                      </div>
                    ) : isHoliday && holidayName ? (
                      <div className="truncate text-[8px] text-amber-600 dark:text-amber-400">
                        {holidayName}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 px-4 py-3 dark:border-[#1e3820]">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:ring-emerald-800" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Batch Cutoff (Sun/Wed · 5 PM PT)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-sky-100 ring-1 ring-sky-200 dark:bg-sky-950/50 dark:ring-sky-800" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">FedEx Ships (Mon/Thu)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-amber-100 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:ring-amber-800" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Holiday / Adjusted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
