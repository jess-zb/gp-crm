"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, memo } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle, List, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AppointmentWhen } from "@/app/components/AppointmentClock";
import { officeDayStartIso, officeTodayYmd } from "@/lib/time/office-calendar";
import { addCalendarDays } from "@/lib/time/zoned";
import type { PipelineKind } from "@/lib/reminders/appointments";
import { AppointmentsCalendar } from "./AppointmentsCalendar";
import { AddAppointmentModal } from "./AddAppointmentModal";
import { ReminderRowActions } from "./RemindersClient";
import { completeReminder } from "./actions";
import {
  APPOINTMENT_TYPES_BY_STAGE,
  getAppointmentPillClass,
  getAppointmentTypeLabel,
} from "@/lib/constants/appointment-types";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { EditAppointmentModal, type EditableAppointment } from "./EditAppointmentModal";

export type AppointmentRow = {
  id: string;
  description: string;
  due_date: string | null;
  client_id: string | null;
  clientName: string;
  clientStage: string | null;
  clientState: string | null;
  clientZip: string | null;
  assigneeName: string;
  assigned_to: string | null;
  appointment_type: string | null;
  pipeline_type: PipelineKind | null;
  notes: string | null;
};

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "pre_auth_appointment", label: "Pre-Auth Appointment" },
  { value: "charge_appointment", label: "Charge Appointment" },
  { value: "decline_appointment", label: "Decline Appointment" },
  { value: "pre_auth_attempt", label: "Pre-Auth Attempt" },
  { value: "charge_attempt", label: "Charge Attempt" },
  { value: "appointment_set", label: "Appointment Set" },
  { value: "cs_intro_call", label: "CS Intro Call" },
  { value: "poa_follow_up_call", label: "POA Follow Up Call" },
  { value: "retention_call", label: "Retention Call" },
  { value: "check_in_30_day", label: "30-Day Check-In" },
  { value: "check_in_60_day", label: "60-Day Check-In" },
  { value: "check_in_90_day", label: "90-Day Check-In" },
  { value: "case_sent_notification", label: "Case Sent Notification" },
] as const;

const SALES_STAGES = ["lead", "account_manager", "retention"] as const;

const SERVICE_STAGES = [
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
  "mortgage",
] as const;

function getTypeOptions(pipeline: PipelineKind) {
  const stages =
    pipeline === "sales" ? [...SALES_STAGES] : [...SERVICE_STAGES];
  const relevantTypes = new Set<string>();
  for (const stage of stages) {
    APPOINTMENT_TYPES_BY_STAGE[stage]?.forEach((t) => {
      relevantTypes.add(t.value);
    });
  }
  const options: { value: string; label: string }[] = [
    { value: "all", label: "All Types" },
  ];
  for (const value of Array.from(relevantTypes)) {
    const fromFilter = TYPE_FILTER_OPTIONS.find((o) => o.value === value);
    if (fromFilter) {
      options.push({ value: fromFilter.value, label: fromFilter.label });
      continue;
    }
    for (const stage of stages) {
      const def = APPOINTMENT_TYPES_BY_STAGE[stage]?.find(
        (t) => t.value === value
      );
      if (def) {
        options.push({ value: def.value, label: def.label });
        break;
      }
    }
  }
  return options;
}

type TeamMember = { id: string; full_name: string | null };

const AppointmentRow = memo(({
  r,
  onComplete,
  onEdit,
  canEdit,
}: {
  r: AppointmentRow;
  onComplete: (id: string) => Promise<void>;
  onEdit: (r: AppointmentRow) => void;
  canEdit: boolean;
}) => {
  function getStatusDot(due_date: string | null) {
    if (!due_date) return null;
    const due = new Date(due_date);
    if (Number.isNaN(due.getTime())) return null;
    const today = officeTodayYmd();
    const startIso = officeDayStartIso(today);
    const endIso = officeDayStartIso(addCalendarDays(today, 1));
    if (!startIso || !endIso) return null;
    const start = new Date(startIso);
    const end = new Date(endIso);

    if (due < start) {
      return (
        <span
          className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500"
          title="Before today"
        />
      );
    }
    if (due < end) {
      return (
        <span
          className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400"
          title="Due today"
        />
      );
    }
    return (
      <span
        className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-400"
        title="Upcoming"
      />
    );
  }

  return (
    <tr className="crm-table-row">
      <td className="crm-table-td">
        {r.client_id ? (
          <Link
            href={`/clients/${r.client_id}`}
            className="crm-link-accent"
          >
            {r.clientName}
          </Link>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </td>
      <td className="crm-table-td align-top">
        <span
          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${getAppointmentPillClass(r.appointment_type ?? "")}`}
        >
          {getAppointmentTypeLabel(r.appointment_type) ||
            r.description ||
            r.appointment_type ||
            "—"}
        </span>
      </td>
      <td className="crm-table-td text-slate-800 dark:text-slate-200">
        <span className="inline-flex items-start gap-2">
          {getStatusDot(r.due_date)}
          <AppointmentWhen iso={r.due_date} state={r.clientState} zip={r.clientZip} />
        </span>
      </td>
      <td className="crm-table-td whitespace-nowrap text-slate-700 dark:text-slate-300">
        {r.assigneeName}
      </td>
      <td className="crm-table-td whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(r)}
                title="Edit appointment"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#242424] dark:hover:text-slate-300"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void onComplete(r.id)}
                title="Mark as complete"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#242424] dark:hover:text-slate-300"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
              <ReminderRowActions reminderId={r.id} />
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
});

AppointmentRow.displayName = "AppointmentRow";

export function AppointmentsView({
  reminders,
  teamMembers,
  currentUserId,
  currentRole,
}: {
  reminders: AppointmentRow[];
  teamMembers: TeamMember[];
  currentUserId: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [pipeline, setPipeline] = useState<PipelineKind>("sales");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<EditableAppointment | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>(reminders);

  useEffect(() => {
    setAppointments(reminders);
  }, [reminders]);

  useEffect(() => {
    setTypeFilter("all");
  }, [pipeline]);

  const typeOptions = useMemo(() => getTypeOptions(pipeline), [pipeline]);

  /** Hide "Dead" appointments from this view (audit trail remains elsewhere). */
  const visibleAppointments = useMemo(
    () =>
      appointments.filter((a) => {
        const t = (a.appointment_type ?? "").trim();
        const d = (a.description ?? "").trim();
        return t !== "Dead" && d !== "Dead";
      }),
    [appointments]
  );

  const handleMarkComplete = async (id: string) => {
    const r = await completeReminder(id);
    if (!r.ok) {
      toast.error(r.error ?? "Failed to update appointment");
      return;
    }

    setAppointments((prev) => prev.filter((a) => a.id !== id));
    toast.success("Appointment completed");
    router.refresh();
  };

  const scoped = useMemo(
    () =>
      visibleAppointments.filter((r) => {
        const p = r.pipeline_type ?? "sales";
        return p === pipeline;
      }),
    [visibleAppointments, pipeline]
  );

  const filteredAppointments = useMemo(
    () =>
      scoped.filter(
        (a) => typeFilter === "all" || (a.appointment_type ?? "").trim() === typeFilter
      ),
    [scoped, typeFilter]
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <CrmPageHeader title="Appointments">
          <button type="button" onClick={() => setModalOpen(true)} className="crm-btn-primary">
            Add Appointment
          </button>
        </CrmPageHeader>

        <div className="mx-auto min-w-0 w-full max-w-6xl flex-1 px-6 py-5">
      <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4 dark:border-[#2E2E2E]">
        <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-[#2E2E2E]">
          <button
            type="button"
            onClick={() => setPipeline("sales")}
            className={`px-4 py-1.5 text-sm font-medium ${
              pipeline === "sales"
                ? "bg-[#A87830] text-[#161616]"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#242424]"
            }`}
          >
            Sales
          </button>
          <button
            type="button"
            onClick={() => setPipeline("service")}
            className={`px-4 py-1.5 text-sm font-medium ${
              pipeline === "service"
                ? "bg-[#A87830] text-[#161616]"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#242424]"
            }`}
          >
            Service
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Filter:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-[13px] text-slate-500 dark:text-slate-400">
            {filteredAppointments.length} appointments
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-[#2E2E2E]">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`flex h-8 w-8 items-center justify-center transition-colors ${
                view === "list"
                  ? "bg-[#A87830] text-[#161616]"
                  : "text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`flex h-8 w-8 items-center justify-center transition-colors ${
                view === "calendar"
                  ? "bg-[#A87830] text-[#161616]"
                  : "text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
              }`}
              title="Calendar view"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {view === "calendar" ? (
        <AppointmentsCalendar appointments={filteredAppointments} onComplete={handleMarkComplete} />
      ) : filteredAppointments.length === 0 ? (
        <div className="crm-card px-6 py-16 text-center text-[13px] text-slate-600 dark:text-slate-400">
          No appointments match this view.
        </div>
      ) : (
        <div className="crm-table-wrap">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="crm-table-head-row">
                  <th className="crm-table-th">Client Name</th>
                  <th className="crm-table-th">Type</th>
                  <th className="crm-table-th">Due Date</th>
                  <th className="crm-table-th">Assigned To</th>
                  <th className="crm-table-th !text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((r) => {
                  const canEdit =
                    currentRole !== "acct_manager" ||
                    r.assigned_to === currentUserId;
                  return (
                    <AppointmentRow
                      key={r.id}
                      r={r}
                      onComplete={handleMarkComplete}
                      onEdit={(row) =>
                        setEditingAppointment({
                          id: row.id,
                          appointment_type: row.appointment_type,
                          due_date: row.due_date,
                          notes: row.notes,
                          assigned_to: row.assigned_to,
                          client_id: row.client_id,
                          clientStage: row.clientStage,
                          clientState: row.clientState,
                          clientZip: row.clientZip,
                        })
                      }
                      canEdit={canEdit}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

        </div>
      </div>

      <AddAppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        teamMembers={teamMembers}
      />
      <EditAppointmentModal
        open={editingAppointment !== null}
        appointment={editingAppointment}
        teamMembers={teamMembers}
        onClose={() => setEditingAppointment(null)}
      />
    </>
  );
}
