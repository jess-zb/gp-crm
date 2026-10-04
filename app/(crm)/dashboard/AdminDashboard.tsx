import { getStageLabel } from "@/lib/constants/stages";
import {
  clientDisplayName,
  countAppointmentsOn,
  daysInStage,
} from "./dashboard-ui";
import { RoleDashboard } from "./RoleDashboard";
import type { DashboardClientRow, TeamActivityRow, TodayAppointmentRow } from "./dashboard-types";

function daysLabel(iso?: string | null) {
  const days = daysInStage(iso);
  if (days == null) return "In the pipeline";
  return days === 1 ? "1 day in stage" : `${days} days in stage`;
}

export function AdminDashboard({
  firstName,
  teamActivity,
  missingCcAuth,
  appointments,
  movedToday,
}: {
  firstName?: string;
  teamActivity: TeamActivityRow[];
  missingCcAuth: DashboardClientRow[];
  appointments: TodayAppointmentRow[];
  movedToday: number;
}) {
  return (
    <RoleDashboard
      firstName={firstName}
      stats={[
        { label: "Missing CC", value: missingCcAuth.length },
        { label: "Clients Moved", value: movedToday },
        { label: "Appointments Today", value: countAppointmentsOn(appointments) },
      ]}
      tableTitle="Missing CC Authorizations"
      tableHref="/clients"
      rows={missingCcAuth.map((client) => ({
        id: client.id,
        href: `/clients/${client.id}?tab=documents&upload=cc_authorization`,
        name: clientDisplayName(client),
        detail: daysLabel(client.stage_entered_at),
        status: "No CC auth",
        tone: "amber" as const,
      }))}
      emptyTable="Every active client in the funnel has a credit card authorization."
      appointments={appointments}
      sideTitle="Client Moved"
      sideHref="/clients"
      sideItems={teamActivity.map((row, index) => ({
        id: `${row.created_at}-${index}`,
        href: row.client?.id ? `/clients/${row.client.id}` : "/clients",
        title: row.client ? clientDisplayName(row.client) : "Client",
        detail: `${row.performed_by_name?.trim() || "Someone"} moved them to ${getStageLabel(String(row.new_value?.stage ?? ""))}`,
      }))}
      emptySide="No clients have moved stages today."
    />
  );
}
