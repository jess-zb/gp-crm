/**
 * Appointments list / modal helpers — thin facade over `workflow-config.ts`.
 * @legacy All label arrays and pipeline rules are defined centrally; this file preserves exports
 * so existing imports (`@/lib/reminders/appointments`) keep working without UI changes.
 */

import {
  getAuto48HourDueLabels,
  getManualDueDateLabels,
  getSalesAppointmentLabelsOrdered,
  getServiceAppointmentLabelsOrdered,
} from "./workflow-config";

export type { PipelineKind } from "./workflow-config";

export { inferPipelineFromClientStage } from "./workflow-config";

/** Grouped sections / modal options — order and strings come from WORKFLOW_TYPES labels in workflow-config. */
export const SALES_APPOINTMENT_TYPES = Object.freeze(
  getSalesAppointmentLabelsOrdered()
) as readonly string[];

export const SERVICE_APPOINTMENT_TYPES = Object.freeze(
  getServiceAppointmentLabelsOrdered()
) as readonly string[];

/** Default +48h due when picking these types in Add Appointment (derived from config). */
export const AUTO_48HR_TYPES: readonly string[] = Object.freeze(getAuto48HourDueLabels());

/** Types that require an explicit due date (legacy behavior). */
export const MANUAL_DATE_TYPES: readonly string[] = Object.freeze(getManualDueDateLabels());

export type AppointmentStatusFilter = "all" | "today" | "upcoming";

export function filterAppointmentByStatus(
  dueDateIso: string | null | undefined,
  statusFilter: AppointmentStatusFilter
): boolean {
  if (statusFilter === "all") return true;
  if (!dueDateIso) {
    return false;
  }
  const due = new Date(dueDateIso);
  if (Number.isNaN(due.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (statusFilter === "today") return due >= todayStart && due <= todayEnd;
  if (statusFilter === "upcoming") return due > todayEnd;
  return true;
}

export function defaultDueDateForAuto48h(): string {
  const d = new Date();
  d.setHours(d.getHours() + 48);
  return d.toISOString();
}
