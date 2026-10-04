import { clientDisplayName, countAppointmentsOn, daysInStage } from "./dashboard-ui";
import { RoleDashboard } from "./RoleDashboard";
import type { DashboardClientRow, TodayAppointmentRow } from "./dashboard-types";

function daysLabel(iso?: string | null) {
  const days = daysInStage(iso);
  if (days == null) return "Account Manager";
  return days === 1 ? "1 day in Account Manager" : `${days} days in Account Manager`;
}

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
  const rnaIds = new Set(rnaMyClients.map((client) => client.id));

  return (
    <RoleDashboard
      firstName={firstName}
      stats={[
        { label: "in Account Manager", value: myAmClients.length },
        { label: "need a call", value: rnaMyClients.length },
        { label: "Appointments Today", value: countAppointmentsOn(myApptToday) },
      ]}
      tableTitle="My clients"
      tableHref="/clients"
      rows={myAmClients.map((client) => ({
        id: client.id,
        href: `/clients/${client.id}`,
        name: clientDisplayName(client),
        detail: client.phone_mobile?.trim() || daysLabel(client.stage_entered_at),
        status: rnaIds.has(client.id) ? "Needs a call" : "In progress",
        tone: rnaIds.has(client.id) ? "red" : "slate",
      }))}
      emptyTable="No clients are assigned to you in Account Manager."
      appointments={myApptToday}
      sideTitle="Needs a call"
      sideHref="/clients"
      sideItems={rnaMyClients.map((client) => ({
        id: client.id,
        href: `/clients/${client.id}`,
        title: clientDisplayName(client),
        detail: client.phone_mobile?.trim() || "Ring no answer. Try them again.",
      }))}
      emptySide="Nobody on your list is waiting on a call."
    />
  );
}
