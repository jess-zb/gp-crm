"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { formatTime } from "@/lib/utils/date";
import { getTimeOfDay } from "./dashboard-ui";
import type { TodayAppointmentRow } from "./dashboard-types";

export type DashboardStat = { label: string; value: number };
export type DashboardTableRow = {
  id: string;
  href: string;
  name: string;
  detail: string;
  status: string;
  tone: "green" | "amber" | "slate" | "red";
};
export type DashboardSideItem = {
  id: string;
  href: string;
  title: string;
  detail: string;
};

const TONE: Record<DashboardTableRow["tone"], string> = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  slate: "bg-slate-100 text-slate-700 dark:bg-[#2A2A2A] dark:text-slate-200",
  red: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
};

function startOfWeek(from: Date) {
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  const weekday = day.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + mondayOffset);
  return day;
}

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sameDay(iso: string, day: Date) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return false;
  return sameCalendarDay(value, day);
}

function clientLabel(row: TodayAppointmentRow) {
  const name = [row.client?.first_name, row.client?.last_name].filter(Boolean).join(" ");
  return name || "Appointment";
}

export function RoleDashboard({
  firstName,
  stats,
  tableTitle,
  tableHref,
  rows,
  emptyTable,
  appointments,
  sideTitle,
  sideHref,
  sideItems,
  emptySide,
}: {
  firstName?: string;
  stats: DashboardStat[];
  tableTitle: string;
  tableHref: string;
  rows: DashboardTableRow[];
  emptyTable: string;
  appointments: TodayAppointmentRow[];
  sideTitle: string;
  sideHref: string;
  sideItems: DashboardSideItem[];
  emptySide: string;
}) {
  const today = useMemo(() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    return day;
  }, []);
  const week = useMemo(() => {
    const start = startOfWeek(today);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [today]);
  const [selected, setSelected] = useState(today);
  const name = firstName?.trim() || "there";
  const selectedAppointments = appointments.filter(
    (row) => row.due_date && sameDay(row.due_date, selected)
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {today.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Good {getTimeOfDay()}, {name}
        </h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-300"
          >
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {stat.value}
            </span>
            {stat.label}
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-[#2E2E2E]">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tableTitle}</h3>
          <Link href={tableHref} className="text-xs font-semibold text-[#A87830] hover:underline">
            See all
          </Link>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{emptyTable}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
            {rows.slice(0, 8).map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-3 dark:hover:bg-[#242424]"
                >
                  <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {row.name}
                  </span>
                  <span className="truncate text-sm text-slate-500 dark:text-slate-400">{row.detail}</span>
                  <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[row.tone]}`}>
                    {row.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#2E2E2E]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
              Appointments
            </h3>
            <Link href="/reminders" className="text-xs font-semibold text-[#A87830] hover:underline">
              See all
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1 px-3 py-3">
            {week.map((day) => {
              const active = sameCalendarDay(day, selected);
              const hasItems = appointments.some((row) => row.due_date && sameDay(row.due_date, day));
              return (
                <button
                  key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                  type="button"
                  aria-pressed={active}
                  aria-label={day.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  onClick={() => setSelected(day)}
                  className={`rounded-lg px-1 py-1.5 text-center ${
                    active
                      ? "bg-[#A87830] text-[#161616]"
                      : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-[#242424]"
                  }`}
                >
                  <span className="block text-[10px] font-semibold uppercase">
                    {day.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}
                  </span>
                  <span className="block text-sm font-semibold tabular-nums">{day.getDate()}</span>
                  <span
                    className={`mx-auto mt-1 block h-1 w-1 rounded-full ${
                      hasItems ? (active ? "bg-[#161616]" : "bg-[#A87830]") : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </div>
          {selectedAppointments.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-slate-500 dark:text-slate-400">
              Nothing scheduled for {selected.toLocaleDateString("en-US", { weekday: "long" })}.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-[#2E2E2E] dark:border-[#2E2E2E]">
              {selectedAppointments.map((row) => (
                <li key={row.id}>
                  <Link
                    href={row.client?.id ? `/clients/${row.client.id}` : "/reminders"}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#242424]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {clientLabel(row)}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {row.description?.trim() || row.appointment_type || "Appointment"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {row.due_date ? formatTime(row.due_date) : "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#2E2E2E]">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sideTitle}</h3>
            <Link href={sideHref} className="text-xs font-semibold text-[#A87830] hover:underline">
              See all
            </Link>
          </div>
          {sideItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{emptySide}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
              {sideItems.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#242424]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{item.detail}</span>
                    </span>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
