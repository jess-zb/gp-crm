import { clientDisplayName, countAppointmentsOn, daysInStage } from "./dashboard-ui";
import { RoleDashboard } from "./RoleDashboard";
import type { DashboardClientRow, TodayAppointmentRow } from "./dashboard-types";

function daysLabel(iso?: string | null) {
  const days = daysInStage(iso);
  if (days == null) return "Client Services";
  return days === 1 ? "1 day in Client Services" : `${days} days in Client Services`;
}

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
  const overdueIds = new Set(poaOverdue.map((client) => client.id));

  return (
    <RoleDashboard
      firstName={firstName}
      stats={[
        { label: "in Client Services", value: mySvcClients.length },
        { label: "POA overdue", value: poaOverdue.length },
        { label: "Appointments Today", value: countAppointmentsOn(myApptToday) },
      ]}
      tableTitle="My clients"
      tableHref="/clients"
      rows={mySvcClients.map((client) => {
        const signed = Boolean(client.poa_signed_at);
        const overdue = overdueIds.has(client.id);
        return {
          id: client.id,
          href: signed ? `/clients/${client.id}` : `/clients/${client.id}?tab=documents&upload=poa_document`,
          name: clientDisplayName(client),
          detail: daysLabel(client.stage_entered_at),
          status: signed ? "POA signed" : overdue ? "POA overdue" : "No POA",
          tone: signed ? "green" : overdue ? "red" : "amber",
        } as const;
      })}
      emptyTable="No clients are assigned to you in Client Services."
      appointments={myApptToday}
      sideTitle="POA follow-up"
      sideHref="/clients"
      sideItems={poaOverdue.map((client) => ({
        id: client.id,
        href: `/clients/${client.id}?tab=documents&upload=poa_document`,
        title: clientDisplayName(client),
        detail: "21+ days in Client Services with no signed POA.",
      }))}
      emptySide="No POA follow-ups are overdue."
    />
  );
}
