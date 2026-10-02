import { DashboardClientTable } from "./DashboardClientTable";
import { TodayAppointments } from "./TodayAppointments";
import { getTimeOfDay } from "./dashboard-ui";
import type { DashboardClientRow, TodayAppointmentRow } from "./dashboard-types";

export function ComplianceDashboard({
  firstName,
  myComplianceClients,
  myApptToday,
}: {
  firstName?: string;
  myComplianceClients: DashboardClientRow[];
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
          Here&apos;s your compliance queue for today.
        </p>
      </div>

      <DashboardClientTable
        title="My Compliance Queue"
        clients={myComplianceClients}
        emptyMessage="No clients in compliance assigned to you"
        columns={["name", "phone", "days_in_stage"]}
        stageColor="compliance_verification"
      />

      <TodayAppointments appointments={myApptToday} />
    </>
  );
}
