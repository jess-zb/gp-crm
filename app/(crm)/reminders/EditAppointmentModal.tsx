"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import {
  getAppointmentTypesForStage,
  type StageAppointmentTypeDef,
} from "@/lib/constants/appointment-types";
import { normalizePipelineStage } from "@/lib/clients/pipeline-status";
import { updateAppointment } from "./actions";
import {
  AppointmentClockPreview,
  appointmentInstantFromClientTime,
  bookingTimeZone,
} from "@/app/components/AppointmentClock";
import { utcToWall } from "@/lib/time/zoned";

export type EditableAppointment = {
  id: string;
  appointment_type: string | null;
  due_date: string | null;
  notes: string | null;
  assigned_to: string | null;
  client_id: string | null;
  clientStage: string | null;
  clientState?: string | null;
  clientZip?: string | null;
};

export function EditAppointmentModal({
  open,
  appointment,
  teamMembers,
  onClose,
}: {
  open: boolean;
  appointment: EditableAppointment | null;
  teamMembers: { id: string; full_name: string | null }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [appointmentType, setAppointmentType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const availableTypes = useMemo((): StageAppointmentTypeDef[] => {
    if (!appointment?.clientStage) return getAppointmentTypesForStage("lead");
    return getAppointmentTypesForStage(normalizePipelineStage(appointment.clientStage));
  }, [appointment?.clientStage]);

  useEffect(() => {
    if (!open || !appointment) return;
    setAppointmentType(appointment.appointment_type ?? "");
    setNotes(appointment.notes ?? "");
    setAssignedTo(appointment.assigned_to ?? "");
    setFieldErrors({});

    if (appointment.due_date) {
      const wall = utcToWall(
        appointment.due_date,
        bookingTimeZone(appointment.clientState, appointment.clientZip).timeZone
      );
      if (wall) {
        setDueDate(wall.ymd);
        setDueTime(wall.hm);
      }
    } else {
      setDueDate("");
      setDueTime("09:00");
    }
  }, [open, appointment]);

  useEffect(() => {
    if (!open) setFieldErrors({});
  }, [open]);

  const onSubmit = () => {
    if (!appointment) return;
    const errors: Record<string, string> = {};
    if (!appointmentType) errors.type = "Please select an appointment type.";
    if (!dueDate.trim()) errors.date = "Please select a date.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in all required fields.");
      return;
    }
    setFieldErrors({});

    const local = appointmentInstantFromClientTime(
      dueDate.trim(),
      (dueTime || "09:00").trim(),
      appointment.clientState,
      appointment.clientZip
    );
    if (!local) {
      toast.error("Invalid date or time.");
      return;
    }

    const selectedDef = availableTypes.find((t) => t.value === appointmentType);

    startTransition(async () => {
      const res = await updateAppointment({
        id: appointment.id,
        appointment_type: appointmentType,
        description: selectedDef?.label ?? appointmentType,
        due_date_iso: local.toISOString(),
        assigned_to: assignedTo.trim() || null,
        notes: notes.trim() || null,
        client_id: appointment.client_id,
      });
      if (!res.ok) {
        toast.error(toUserFacingError(res.error));
        return;
      }
      toast.success("Appointment updated");
      onClose();
      router.refresh();
    });
  };

  if (!open || !appointment) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-appointment-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-6 pb-4 pt-6">
          <h3 id="edit-appointment-title" className="crm-modal-title">
            Edit Appointment
          </h3>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <label className="mb-4 block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Appointment type <span className="text-red-500">*</span>
            </span>
            <select
              value={appointmentType}
              onChange={(e) => setAppointmentType(e.target.value)}
              className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:bg-[#121212] dark:text-white ${
                fieldErrors.type ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-[#2E2E2E]"
              }`}
            >
              <option value="">Select type…</option>
              {availableTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {fieldErrors.type && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.type}</p>
            )}
          </label>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Date ({bookingTimeZone(appointment.clientState, appointment.clientZip).label}){" "}
                <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:bg-[#121212] dark:text-white ${
                  fieldErrors.date ? "border-red-500 dark:border-red-500" : "border-slate-200 dark:border-[#2E2E2E]"
                }`}
              />
              {fieldErrors.date && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.date}</p>
              )}
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Time ({bookingTimeZone(appointment.clientState, appointment.clientZip).label})
              </span>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
              />
            </label>
          </div>
          <div className="mb-4">
            <AppointmentClockPreview
              date={dueDate}
              time={dueTime || "09:00"}
              state={appointment.clientState}
              zip={appointment.clientZip}
            />
          </div>

          <label className="mb-4 block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
            />
          </label>

          <label className="mb-2 block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Assigned to</span>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
            >
              <option value="">—</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name?.trim() || m.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex-shrink-0 border-t border-gray-100 px-6 pb-6 pt-4 dark:border-[#2E2E2E]">
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="crm-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onSubmit}
              className="crm-btn-primary min-w-[80px] disabled:opacity-50"
            >
              {pending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
