import { DashboardClientTable } from "./DashboardClientTable";
import { TodayAppointments } from "./TodayAppointments";
import { getTimeOfDay } from "./dashboard-ui";
import type { DashboardClientRow, TodayAppointmentRow } from "./dashboard-types";

export function ServicesDashboard({
  firstName,
  mySvcClients,
  poaOverdue,
  myApptToday,
}: {
  firstName?: string;
  mySvcClients: DashboardClientRow[];
  poaOverdue: DashboardClientRow[];
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
          Here&apos;s your client services queue for today.
        </p>
      </div>

      <DashboardClientTable
        title="My Client Services Clients"
        clients={mySvcClients}
        emptyMessage="No clients in Client Services assigned to you"
        columns={["name", "phone", "poa_status", "days_in_stage"]}
        stageColor="client_services"
      />

      <DashboardClientTable
        title="POA Follow-Up Overdue"
        subtitle="21+ days in Client Services with no signed POA received"
        clients={poaOverdue}
        emptyMessage="All POAs received ✓"
        columns={["name", "phone", "days_in_stage"]}
        alertColor="red"
      />

      <TodayAppointments appointments={myApptToday} />
    </>
  );
}
