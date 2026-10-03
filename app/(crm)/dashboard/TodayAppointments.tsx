import Link from "next/link";
import { getAppointmentPillClass } from "@/lib/constants/appointment-types";
import { formatTime } from "@/lib/utils/date";
import type { TodayAppointmentRow } from "./dashboard-types";

function dotClass(appointmentType: string | null) {
  const pill = getAppointmentPillClass(appointmentType ?? "");
  if (pill.includes("red")) return "bg-red-500";
  if (pill.includes("amber")) return "bg-amber-500";
  return "bg-emerald-500";
}

export function TodayAppointments({
  appointments,
}: {
  appointments: TodayAppointmentRow[];
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#2E2E2E]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Today&apos;s Appointments
        </h3>
        <Link
          href="/reminders"
          className="text-xs text-[#A87830] hover:underline dark:text-[#A87830]"
        >
          View all →
        </Link>
      </div>
      {appointments.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            No appointments scheduled for today
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Check the Reminders page to see your full schedule.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-[#2E2E2E]">
          {appointments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(
                    a.appointment_type
                  )}`}
                  aria-label={`Appointment type: ${a.appointment_type || 'General'}`}
                  title={`Priority: ${a.appointment_type || 'General'}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {a.client?.first_name} {a.client?.last_name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {a.description}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                {a.due_date ? formatTime(a.due_date) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
