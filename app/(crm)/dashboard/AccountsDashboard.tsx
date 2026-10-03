import { DashboardClientTable } from "./DashboardClientTable";
import { TodayAppointments } from "./TodayAppointments";
import { getTimeOfDay } from "./dashboard-ui";
import type { DashboardClientRow, TodayAppointmentRow } from "./dashboard-types";

export function AccountsDashboard({
  firstName,
  myAmClients,
  rnaMyClients,
  myApptToday,
}: {
  firstName?: string;
  myAmClients: DashboardClientRow[];
  rnaMyClients: DashboardClientRow[];
  myApptToday: TodayAppointmentRow[];
}) {
  const name = firstName?.trim() || "there";

  return (
    <>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Good {getTimeOfDay()}, {name} 👋
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Here&apos;s your account manager queue for today.
        </p>
      </div>

      <DashboardClientTable
        title="My Account Manager Clients"
        clients={myAmClients}
        emptyMessage="No clients in your Account Manager queue"
        columns={["name", "phone", "sub_status", "days_in_stage"]}
        stageColor="account_manager"
      />

      <DashboardClientTable
        title="RNA — Needs Contact"
        subtitle="These clients haven't answered. Try reaching them now."
        clients={rnaMyClients}
        emptyMessage="No RNA clients ✓"
        columns={["name", "phone", "days_in_stage"]}
        alertColor="red"
      />

      <TodayAppointments appointments={myApptToday} />
    </>
  );
}
