"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import type { AppointmentRow } from "./AppointmentsView";

type AppointmentsCalendarProps = {
  appointments: AppointmentRow[];
  onComplete: (id: string) => void | Promise<void>;
};

const PIPELINE_COLORS: Record<string, string> = {
  sales: "bg-blue-500",
  service: "bg-[#A87830]",
};

function dateKeyFromParts(y: number, m0: number, day: number) {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateKeyFromIso(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return dateKeyFromParts(d.getFullYear(), d.getMonth(), d.getDate());
}

export function AppointmentsCalendar({ appointments, onComplete }: AppointmentsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const apptsByDate = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    for (const appt of appointments) {
      if (!appt.due_date) continue;
      const key = dateKeyFromIso(appt.due_date);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    }
    return map;
  }, [appointments]);

  const today = new Date();
  const todayKey = dateKeyFromParts(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const getDateKey = (day: number) => dateKeyFromParts(year, month, day);

  return (
    <div className="crm-table-wrap dark:border-[#2E2E2E]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#2E2E2E]">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-[#242424]"
          title="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="font-semibold text-gray-900 dark:text-white">{monthName}</h2>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-[#242424]"
          title="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-[#2E2E2E]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-[#2E2E2E]">
        {cells.map((day, idx) => {
          if (day == null) {
            return <div key={`empty-${idx}`} className="min-h-[100px] bg-gray-50/50 dark:bg-[#121212]/40" />;
          }

          const key = getDateKey(day);
          const dayAppts = apptsByDate[key] ?? [];
          const isToday = key === todayKey;
          const cellStart = new Date(year, month, day);
          cellStart.setHours(0, 0, 0, 0);
          const todayStartCal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const isPast = cellStart < todayStartCal && key !== todayKey;

          return (
            <div
              key={key}
              className={`min-h-[100px] p-1.5 transition-colors ${
                isToday
                  ? "bg-green-50/50 dark:bg-emerald-950/30"
                  : isPast
                    ? "bg-gray-50/30 dark:bg-[#121212]/50"
                    : "bg-white hover:bg-gray-50/50 dark:bg-[#1C1C1C] dark:hover:bg-[#242424]/60"
              }`}
            >
              <div
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-[#A87830] text-[#161616]" : "text-gray-600 dark:text-slate-300"
                }`}
              >
                {day}
              </div>

              <div className="space-y-0.5">
                {dayAppts.slice(0, 3).map((appt) => {
                  const p = appt.pipeline_type ?? "sales";
                  return (
                    <div
                      key={appt.id}
                      className="group flex cursor-default items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 transition-colors hover:border-[#A87830] dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:hover:border-[#A87830]"
                    >
                      <div
                        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${PIPELINE_COLORS[p] ?? "bg-gray-400"}`}
                      />
                      <p className="flex-1 truncate text-xs leading-tight text-gray-700 dark:text-slate-200">
                        {appt.clientName?.trim() || "—"}
                      </p>
                      <button
                        type="button"
                        onClick={() => void onComplete(appt.id)}
                        title="Mark complete"
                        className="flex-shrink-0 text-gray-300 opacity-0 transition-all hover:text-emerald-500 group-hover:opacity-100 dark:text-slate-600 dark:hover:text-emerald-400"
                      >
                        <CheckCircle className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {dayAppts.length > 3 ? (
                  <p className="px-1.5 text-xs text-gray-400 dark:text-slate-500">
                    +{dayAppts.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 border-t border-gray-100 bg-gray-50/50 px-5 py-3 dark:border-[#2E2E2E] dark:bg-[#121212]/40">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-500 dark:text-slate-400">Sales</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#A87830]" />
          <span className="text-xs text-gray-500 dark:text-slate-400">Service</span>
        </div>
      </div>
    </div>
  );
}
