"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";

import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";

import { DictationMicButton } from "@/app/components/DictationMicButton";
import { ChevronDown, Loader2, Mail, MessageSquare, Pencil, Phone, Pin, Plus, X } from "lucide-react";
import {
  completeWorkflowTask,
} from "@/lib/reminders/workflow";
import { createAppointmentFromModal } from "../../reminders/actions";
import type { AppointmentModalResult } from "../../reminders/actions";
import { EditAppointmentModal, type EditableAppointment } from "../../reminders/EditAppointmentModal";
import { getAppointmentTypesForStage } from "@/lib/constants/appointment-types";
import { normalizePipelineStage } from "@/lib/clients/pipeline-status";

export type ReminderRow = {
  id: string;
  description: string;
  due_date: string | null;
  completed: boolean;
  cancelled: boolean;
  completed_at: string | null;
  assigned_to: string | null;
  appointment_type: string | null;
  notes: string | null;
};

export type SidebarCommNoteRow = {
  id: string;
  body: string;
  sent_at: string | null;
  author_name: string;
  is_pinned: boolean;
};

function truncateNote(body: string, max = 80): string {
  const t = body.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}...`;
}

export function ClientRightSidebar({
  clientId,
  clientStage,
  reminders,
  commNotes,
  accountInfo,
  auditPerformedByName,
  staffOptions,
  currentUserId,
  currentRole,
  className = "",
  layout = "sidebar",
  showAccountInfo = true,
}: {
  clientId: string;
  /** Current pipeline stage — drives workflow department / keys on new reminders */
  clientStage: string | null;
  reminders: ReminderRow[];
  commNotes: SidebarCommNoteRow[];
  /** Shown on `appointment_completed` audit rows (current viewer). */
  auditPerformedByName: string;
  staffOptions: { id: string; full_name: string | null }[];
  currentUserId: string;
  currentRole: string;
  /** `main` fills the Overview column. `sidebar` is the narrow rail. */
  layout?: "sidebar" | "main";
  showAccountInfo?: boolean;
  accountInfo: {
    created_at: string | null;
    id: string;
    verbal_password: string | null;
    updated_at: string | null;
    assigned_to: string | null;
    assigned_user: { full_name: string | null } | null;
    attorney: { full_name: string | null; email: string | null } | null;
  };
  className?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [localRows, setLocalRows] = useState<ReminderRow[]>([]);
  const [serverRows, setServerRows] = useState(reminders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [appointmentType, setAppointmentType] = useState("");
  const [notesAppt, setNotesAppt] = useState("");
  const [assignToId, setAssignToId] = useState("");
  const [saving, setSaving] = useState(false);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<EditableAppointment | null>(null);
  type SidebarCommModal = "call" | "sms" | "email" | "note" | null;
  const [commModal, setCommModal] = useState<SidebarCommModal>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [localCommNotes, setLocalCommNotes] = useState<SidebarCommNoteRow[]>(commNotes);
  const [openSections, setOpenSections] = useState<{ notes: boolean; appts: boolean; account: boolean }>({
    notes: true,
    appts: true,
    account: true,
  });
  const toggleSection = (k: "notes" | "appts" | "account") =>
    setOpenSections((prev) => ({ ...prev, [k]: !prev[k] }));
  const [sbDirection, setSbDirection] = useState<"inbound" | "outbound">("outbound");
  const [sbLoggedAtIso, setSbLoggedAtIso] = useState("");
  const [sbCallNotes, setSbCallNotes] = useState("");
  const [sbSmsBody, setSbSmsBody] = useState("");
  const [sbEmailSubject, setSbEmailSubject] = useState("");
  const [sbEmailBody, setSbEmailBody] = useState("");
  const [sbCommSaving, setSbCommSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function openSidebarCommModal(kind: Exclude<SidebarCommModal, null>) {
    setCommModal(kind);
    setSbDirection("outbound");
    setSbLoggedAtIso(new Date().toISOString());
    setSbCallNotes("");
    setSbSmsBody("");
    setSbEmailSubject("");
    setSbEmailBody("");
    setNoteText("");
  }

  function closeSidebarCommModal() {
    setCommModal(null);
    setSbCommSaving(false);
    setNoteText("");
  }

  useEffect(() => {
    if (!reminderFormOpen) return;
    setAppointmentType("");
    setNotesAppt("");
    setAssignToId((prev) => prev || (accountInfo.assigned_to ?? ""));
  }, [reminderFormOpen, accountInfo.assigned_to]);

  useEffect(() => {
    setServerRows(reminders);
  }, [reminders]);

  useEffect(() => {
    setLocalCommNotes(commNotes);
  }, [commNotes]);

  useEffect(() => {
    setLocalRows((prev) =>
      prev.filter(
        (local) =>
          !serverRows.some(
            (s) =>
              s.id === local.id ||
              (s.description === local.description &&
                s.due_date === local.due_date)
          )
      )
    );
  }, [serverRows]);

  const reminderRows = useMemo(() => {
    const pendingLocal = localRows.filter(
      (local) =>
        !serverRows.some(
          (s) =>
            s.id === local.id ||
            (s.description === local.description &&
              s.due_date === local.due_date)
        )
    );
    return [...pendingLocal, ...serverRows].sort((a, b) => {
      const ta = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
  }, [localRows, serverRows]);

  const activeReminders = reminderRows.filter(
    (r) => !r.completed && r.completed_at == null && !r.cancelled
  );

  const appointmentTypes = getAppointmentTypesForStage(normalizePipelineStage(clientStage));

  const closeAppointmentModal = useCallback(() => {
    setReminderFormOpen(false);
    setAppointmentType("");
    setNotesAppt("");
    setDueDate("");
    setDueTime("");
    setFieldErrors({});
  }, []);

  useEffect(() => {
    if (!reminderFormOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) closeAppointmentModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reminderFormOpen, saving, closeAppointmentModal]);

  async function addReminder(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const errors: Record<string, string> = {};

    const def = appointmentTypes.find((t) => t.value === appointmentType);
    if (!appointmentType || !def) {
      errors.appointmentType = "Select an appointment type.";
    }
    if (!dueDate.trim()) {
      errors.dueDate = "Due date is required.";
    }
    const t = dueTime.trim() || "09:00";
    const local = new Date(`${dueDate.trim()}T${t}:00`);
    if (Number.isNaN(local.getTime())) {
      errors.dateTime = "Invalid date or time.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (!def) return;

    setSaving(true);
    try {
      const res: AppointmentModalResult = await createAppointmentFromModal({
        client_id: clientId,
        appointment_type: appointmentType,
        description: def.label,
        due_date_iso: local.toISOString(),
        assigned_to: assignToId.trim() || accountInfo.assigned_to || null,
        notes: notesAppt.trim() || null,
        pipeline_type: def.pipeline,
      });
      if (!res.ok) {
        toast.error(toUserFacingError(res.error));
        return;
      }
      setLocalRows((prev) => [...prev, res.newReminder]);
      toast.success("Appointment created");
      closeAppointmentModal();
      router.refresh();
    } catch (err) {
      console.error("[ClientRightSidebar] addReminder:", err);
      toast.error(
        toUserFacingError(
          err instanceof Error ? err.message : "Failed to create appointment"
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function markReminderComplete(reminderId: string) {
    const reminder = reminderRows.find((r) => r.id === reminderId);
    if (!reminder) return;

    setBusyId(reminderId);
    const supabase = createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      toast.error("Not signed in.");
      setBusyId(null);
      return;
    }

    const completedAt = new Date().toISOString();
    const { error } = await completeWorkflowTask(supabase, reminderId, {
      clientId,
    });

    if (error) {
      toast.error(toUserFacingError(error.message));
      setBusyId(null);
      return;
    }

    const { error: auditErr } = await supabase.from("audit_log").insert({
      client_id: clientId,
      action: "appointment_completed",
      new_value: {
        description: reminder.description,
        due_date: reminder.due_date,
        completed_at: completedAt,
      },
      performed_by: user.id,
      performed_by_name: auditPerformedByName,
    });
    if (auditErr) {
      console.error("[markReminderComplete] audit error:", auditErr.message);
    }

    setLocalRows((prev) => prev.filter((r) => r.id !== reminderId));
    setServerRows((prev) => prev.filter((r) => r.id !== reminderId));
    toast.success("Appointment completed");
    setBusyId(null);
    router.refresh();
  }

  async function handleSaveNote() {
    setFieldErrors({});
    const body = noteText.trim();
    if (!body) {
      setFieldErrors({ noteText: "Note text is required." });
      return;
    }
    setSavingNote(true);
    const supabase = createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      toast.error("Not signed in.");
      setSavingNote(false);
      return;
    }
    const { data: saved, error } = await supabase
      .from("communications")
      .insert({
        client_id: clientId,
        type: "note",
        direction: "internal",
        body,
        recorded_by: user.id,
        sent_at: sbLoggedAtIso || new Date().toISOString(),
        subject: null,
        duration_seconds: null,
      })
      .select("id, body, sent_at, is_pinned")
      .single();
    setSavingNote(false);
    if (error || !saved) {
      toast.error(toUserFacingError(error?.message ?? "Could not save the note."));
      return;
    }
    setLocalCommNotes((prev) => [
      {
        id: saved.id,
        body: saved.body ?? body,
        sent_at: saved.sent_at,
        author_name: auditPerformedByName,
        is_pinned: !!saved.is_pinned,
      },
      ...prev.filter((note) => note.id !== saved.id),
    ]);
    toast.success("Note saved");
    setNoteText("");
    closeSidebarCommModal();
    router.refresh();
  }

  async function handleToggleNotePin(noteId: string) {
    const note = localCommNotes.find((n) => n.id === noteId);
    if (!note) return;
    const newPinned = !note.is_pinned;
    setLocalCommNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, is_pinned: newPinned } : n))
    );
    const supabase = createClient();
    const { data, error } = await supabase
      .from("communications")
      .update({ is_pinned: newPinned })
      .eq("id", noteId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      setLocalCommNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, is_pinned: !newPinned } : n))
      );
      toast.error("Failed to update pin");
    }
  }

  async function handleSaveSidebarComm() {
    if (!commModal || commModal === "note") return;
    setFieldErrors({});
    const errors: Record<string, string> = {};

    const supabase = createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      toast.error("Not signed in.");
      return;
    }
    const sentAt = sbLoggedAtIso || new Date().toISOString();
    let insert: Record<string, unknown>;

    if (commModal === "call") {
      const notes = sbCallNotes.trim();
      if (!notes) {
        errors.sbCallNotes = "Notes are required.";
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      insert = {
        client_id: clientId,
        type: "call",
        direction: sbDirection,
        body: notes,
        duration_seconds: null,
        recorded_by: user.id,
        sent_at: sentAt,
        subject: null,
      };
    } else if (commModal === "sms") {
      const msg = sbSmsBody.trim();
      if (!msg) {
        errors.sbSmsBody = "Message is required.";
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      insert = {
        client_id: clientId,
        type: "sms",
        direction: sbDirection,
        body: msg,
        duration_seconds: null,
        recorded_by: user.id,
        sent_at: sentAt,
        subject: null,
      };
    } else {
      const sub = sbEmailSubject.trim();
      const body = sbEmailBody.trim();
      if (!sub) {
        errors.sbEmailSubject = "Subject is required.";
      }
      if (!body) {
        errors.sbEmailBody = "Body is required.";
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      insert = {
        client_id: clientId,
        type: "email",
        direction: sbDirection,
        subject: sub,
        body,
        duration_seconds: null,
        recorded_by: user.id,
        sent_at: sentAt,
      };
    }

    setSbCommSaving(true);
    const { error } = await supabase.from("communications").insert(insert);
    setSbCommSaving(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    toast.success("Saved");
    closeSidebarCommModal();
    router.refresh();
  }

  return (
    <aside
      className={
        layout === "main"
          ? `w-full space-y-6 ${className}`
          : `w-full shrink-0 space-y-6 lg:min-w-[320px] lg:w-80 ${className}`
      }
    >
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => toggleSection("appts")}
            aria-expanded={openSections.appts}
            className="flex items-center gap-1.5 rounded text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.appts ? "" : "-rotate-90"}`} aria-hidden />
            Appointments
          </button>
          <button
            type="button"
            onClick={() => setReminderFormOpen(true)}
            className="inline-flex min-h-11 min-w-[44px] items-center justify-center text-xs font-medium text-[#A87830] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830]"
          >
            Add +
          </button>
        </div>
        {openSections.appts ? (
        <>
        {!activeReminders.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-[#2E2E2E] dark:text-slate-400">
            No active appointments. Click 'Add +' to schedule one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2E2E2E]">
                  <th className="py-2 pr-2 font-semibold">Due</th>
                  <th className="py-2 pr-2 font-semibold">Appointment</th>
                  <th className="py-2 pr-1 font-semibold text-center">St</th>
                  <th className="py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeReminders.map((r) => {
                  const canEdit =
                    currentRole !== "acct_manager" ||
                    r.assigned_to === currentUserId;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 last:border-0 dark:border-[#2E2E2E]"
                    >
                      <td className="py-2 pr-2 align-top text-slate-600 dark:text-slate-300">
                        <ClientFormattedDate
                          iso={r.due_date}
                          pattern="MMM d, yyyy, h:mm a"
                        />
                      </td>
                      <td className="py-2 pr-2 align-top text-slate-800 dark:text-slate-200">
                        {r.description}
                      </td>
                      <td className="py-2 pr-1 text-center align-top text-base" title="Pending">
                        🕐
                      </td>
                      <td className="py-2 text-right align-top">
                        {canEdit ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingReminder({
                                  id: r.id,
                                  appointment_type: r.appointment_type,
                                  due_date: r.due_date,
                                  notes: r.notes,
                                  assigned_to: r.assigned_to,
                                  client_id: clientId,
                                  clientStage: clientStage,
                                })
                              }
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:hover:bg-[#242424] dark:hover:text-slate-300"
                              title="Edit appointment"
                              aria-label="Edit appointment"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => void markReminderComplete(r.id)}
                              className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-[#A87830] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-[#2E2E2E] dark:hover:bg-[#242424]"
                              title="Mark complete"
                              aria-label="Mark complete"
                            >
                              {busyId === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "✓"
                              )}
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => toggleSection("notes")}
            aria-expanded={openSections.notes}
            className="flex items-center gap-1.5 rounded text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.notes ? "" : "-rotate-90"}`} aria-hidden />
            Notes
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openSidebarCommModal("call")}
              title="Add Call"
              aria-label="Add Call"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:text-slate-500 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
            >
              <Phone className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openSidebarCommModal("sms")}
              title="Add Text"
              aria-label="Add Text"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:text-slate-500 dark:hover:bg-green-950/30 dark:hover:text-green-400"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openSidebarCommModal("email")}
              title="Add Email"
              aria-label="Add Email"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:text-slate-500 dark:hover:bg-purple-950/30 dark:hover:text-purple-400"
            >
              <Mail className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openSidebarCommModal("note")}
              title="Add Note"
              aria-label="Add Note"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:text-slate-500 dark:hover:bg-[#2a3f2c] dark:hover:text-slate-200"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {openSections.notes ? (
        <>
        {!localCommNotes.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-[#2E2E2E] dark:text-slate-400">
            No notes yet. Use the icons above to log a call, text, email, or internal note.
          </p>
        ) : (
          <ul className="max-h-96 space-y-3 overflow-y-auto">
            {[...localCommNotes]
              .sort((a, b) => {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
                return new Date(b.sent_at ?? 0).getTime() - new Date(a.sent_at ?? 0).getTime();
              })
              .map((n) => (
                <li key={n.id}>
                  <div
                    className={`group relative w-full rounded-lg border p-3 text-left transition ${
                      n.is_pinned
                        ? "border-amber-300 bg-amber-50/80 dark:border-amber-700/60 dark:bg-amber-950/20"
                        : "border-slate-100 bg-slate-50/80 hover:bg-slate-100 dark:border-[#2E2E2E] dark:bg-[#121212]/40 dark:hover:bg-[#242424]"
                    }`}
                  >
                    {n.is_pinned ? (
                      <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        <Pin className="h-3 w-3 fill-current" aria-hidden />
                        Pinned
                      </span>
                    ) : null}
                    <Link
                      href={`/clients/${clientId}?tab=communications#comm-${n.id}`}
                      className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830]"
                    >
                      <p className={`line-clamp-2 break-words pr-14 text-sm ${n.is_pinned ? "text-amber-900 dark:text-amber-100" : "text-slate-800 dark:text-slate-200"}`}>
                        {truncateNote(n.body)}
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {n.author_name}
                        <span className="mx-1">·</span>
                        <ClientFormattedDate iso={n.sent_at} pattern="MM/dd/yy h:mm a" />
                      </p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleToggleNotePin(n.id)}
                      title={n.is_pinned ? "Unpin note" : "Pin note"}
                      aria-label={n.is_pinned ? "Unpin note" : "Pin note"}
                      className={`absolute bottom-2 right-2 rounded p-1 text-xs transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] ${
                        n.is_pinned
                          ? "text-amber-500 opacity-100 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                          : "text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-500 dark:text-slate-600 dark:hover:text-amber-400"
                      }`}
                    >
                      <Pin className={`h-3 w-3 ${n.is_pinned ? "fill-current" : ""}`} aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
        <div className="mt-3 text-center">
          <Link
            href={`/clients/${clientId}?tab=communications`}
            className="text-xs font-semibold text-[#A87830] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830]"
          >
            View all notes
          </Link>
        </div>
        </>
        ) : null}
      </section>

      {reminderFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reminder-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) closeAppointmentModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h4
                id="reminder-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Add appointment
              </h4>
              <button
                type="button"
                disabled={saving}
                onClick={closeAppointmentModal}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] disabled:opacity-50 dark:hover:bg-[#242424]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={addReminder} className="space-y-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Appointment type</span>
                <select
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value)}
                  required
                  className={`mt-1 w-full rounded-lg border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                    fieldErrors.appointmentType
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                      : "border-slate-200 dark:border-[#2E2E2E]"
                  }`}
                >
                  <option value="">Select type…</option>
                  {appointmentTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.appointmentType && (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {fieldErrors.appointmentType}
                  </p>
                )}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Due date</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className={`mt-1 w-full rounded-lg border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                      fieldErrors.dueDate || fieldErrors.dateTime
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                        : "border-slate-200 dark:border-[#2E2E2E]"
                    }`}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Time</span>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                      fieldErrors.dateTime
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                        : "border-slate-200 dark:border-[#2E2E2E]"
                    }`}
                  />
                </label>
              </div>
              {fieldErrors.dueDate && (
                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                  {fieldErrors.dueDate}
                </p>
              )}
              {fieldErrors.dateTime && (
                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                  {fieldErrors.dateTime}
                </p>
              )}
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Notes (optional)</span>
                <textarea
                  value={notesAppt}
                  onChange={(e) => setNotesAppt(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Assigned to</span>
                <select
                  value={assignToId}
                  onChange={(e) => setAssignToId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                >
                  <option value="">—</option>
                  {staffOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name?.trim() || m.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeAppointmentModal}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="crm-btn-primary inline-flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showAccountInfo ? (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <button
          type="button"
          onClick={() => toggleSection("account")}
          aria-expanded={openSections.account}
          className="mb-3 flex items-center gap-1.5 rounded text-sm font-bold text-slate-900 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:text-white dark:hover:text-slate-200"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSections.account ? "" : "-rotate-90"}`} aria-hidden />
          Account information
        </button>
        {openSections.account ? (
        <>
        <div className="space-y-0">
          <div className="flex items-start justify-between py-1.5">
            <span className="text-xs text-gray-500 dark:text-slate-400">Created</span>
            <span className="max-w-[60%] text-right text-xs font-medium text-gray-800 dark:text-slate-100">
              <ClientFormattedDate
                iso={accountInfo.created_at}
                pattern="MMM d, yyyy, h:mm a"
              />
            </span>
          </div>
          <div className="flex items-start justify-between py-1.5">
            <span className="text-xs text-gray-500 dark:text-slate-400">Verbal Password</span>
            <span className="max-w-[60%] text-right text-xs font-medium text-gray-800 dark:text-slate-100">
              {accountInfo.verbal_password || "—"}
            </span>
          </div>
          <div className="flex items-start justify-between py-1.5">
            <span className="text-xs text-gray-500 dark:text-slate-400">Last activity</span>
            <span className="max-w-[60%] text-right text-xs font-medium text-gray-800 dark:text-slate-100">
              <ClientFormattedDate
                iso={accountInfo.updated_at}
                pattern="MMM d, yyyy, h:mm a"
              />
            </span>
          </div>
        </div>

        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-[#2E2E2E]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Assigned Attorney
          </p>
          {accountInfo.attorney?.full_name ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700 dark:text-slate-200">
                {accountInfo.attorney.full_name}
              </p>
              {accountInfo.attorney.email ? (
                <p className="text-xs text-gray-500 dark:text-slate-400">{accountInfo.attorney.email}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs italic text-gray-400 dark:text-slate-500">No attorney assigned</p>
          )}
        </div>
        </>
        ) : null}
      </section>
      ) : null}

      {commModal === "call" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !sbCommSaving) closeSidebarCommModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-sm dark:border dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Add Call</h3>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Logged at: <ClientFormattedDate iso={sbLoggedAtIso} pattern="MM/dd/yy h:mm a" />
            </p>
            <div className="mb-3 flex gap-2">
              {(["inbound", "outbound"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSbDirection(d)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize ${
                    sbDirection === d
                      ? "border-[#A87830] bg-[#A87830]/10 text-[#A87830]"
                      : "border-slate-200 text-slate-600 dark:border-[#2E2E2E] dark:text-slate-300"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Notes</label>
            <textarea
              value={sbCallNotes}
              onChange={(e) => setSbCallNotes(e.target.value)}
              rows={4}
              className={`mt-1 w-full resize-none rounded-lg border px-3 py-2 text-sm focus:border-[#A87830] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                fieldErrors.sbCallNotes
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                  : "border-gray-200 dark:border-[#2E2E2E]"
              }`}
            />
            {fieldErrors.sbCallNotes && (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                {fieldErrors.sbCallNotes}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={sbCommSaving}
                onClick={() => closeSidebarCommModal()}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-slate-700 dark:border-[#2E2E2E] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sbCommSaving}
                onClick={() => void handleSaveSidebarComm()}
                className="crm-btn-primary flex-1 inline-flex items-center justify-center gap-2"
              >
                {sbCommSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {commModal === "sms" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !sbCommSaving) closeSidebarCommModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:border dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Add Text</h3>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Logged at: <ClientFormattedDate iso={sbLoggedAtIso} pattern="MM/dd/yy h:mm a" />
            </p>
            <div className="mb-3 flex gap-2">
              {(["inbound", "outbound"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSbDirection(d)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize ${
                    sbDirection === d
                      ? "border-[#A87830] bg-[#A87830]/10 text-[#A87830]"
                      : "border-slate-200 text-slate-600 dark:border-[#2E2E2E] dark:text-slate-300"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Message</label>
            <textarea
              value={sbSmsBody}
              onChange={(e) => setSbSmsBody(e.target.value)}
              rows={4}
              className={`mt-1 w-full resize-none rounded-lg border px-3 py-2 text-sm focus:border-[#A87830] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                fieldErrors.sbSmsBody
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                  : "border-gray-200 dark:border-[#2E2E2E]"
              }`}
            />
            {fieldErrors.sbSmsBody && (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                {fieldErrors.sbSmsBody}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={sbCommSaving}
                onClick={() => closeSidebarCommModal()}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-slate-700 dark:border-[#2E2E2E] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sbCommSaving}
                onClick={() => void handleSaveSidebarComm()}
                className="crm-btn-primary flex-1 inline-flex items-center justify-center gap-2"
              >
                {sbCommSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {commModal === "email" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !sbCommSaving) closeSidebarCommModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:border dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Add Email</h3>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Logged at: <ClientFormattedDate iso={sbLoggedAtIso} pattern="MM/dd/yy h:mm a" />
            </p>
            <div className="mb-3 flex gap-2">
              {(["inbound", "outbound"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSbDirection(d)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize ${
                    sbDirection === d
                      ? "border-[#A87830] bg-[#A87830]/10 text-[#A87830]"
                      : "border-slate-200 text-slate-600 dark:border-[#2E2E2E] dark:text-slate-300"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <label className="mt-2 block text-xs font-medium text-slate-600 dark:text-slate-400">Subject</label>
            <input
              type="text"
              value={sbEmailSubject}
              onChange={(e) => setSbEmailSubject(e.target.value)}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-[#A87830] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                fieldErrors.sbEmailSubject
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                  : "border-gray-200 dark:border-[#2E2E2E]"
              }`}
            />
            {fieldErrors.sbEmailSubject && (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                {fieldErrors.sbEmailSubject}
              </p>
            )}
            <label className="mt-2 block text-xs font-medium text-slate-600 dark:text-slate-400">Body</label>
            <textarea
              value={sbEmailBody}
              onChange={(e) => setSbEmailBody(e.target.value)}
              rows={4}
              className={`mt-1 w-full resize-none rounded-lg border px-3 py-2 text-sm focus:border-[#A87830] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                fieldErrors.sbEmailBody
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                  : "border-gray-200 dark:border-[#2E2E2E]"
              }`}
            />
            {fieldErrors.sbEmailBody && (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                {fieldErrors.sbEmailBody}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={sbCommSaving}
                onClick={() => closeSidebarCommModal()}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-slate-700 dark:border-[#2E2E2E] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sbCommSaving}
                onClick={() => void handleSaveSidebarComm()}
                className="crm-btn-primary flex-1 inline-flex items-center justify-center gap-2"
              >
                {sbCommSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {commModal === "note" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingNote) closeSidebarCommModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:border dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Add Note</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Logged at: <ClientFormattedDate iso={sbLoggedAtIso} pattern="MM/dd/yy h:mm a" />
                </p>
              </div>
              <DictationMicButton
                value={noteText}
                onChange={setNoteText}
                disabled={savingNote}
              />
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write your note here, or click Dictate to speak it…"
              rows={6}
              className={`w-full resize-none rounded-lg border px-3 py-2 text-sm focus:border-[#A87830] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:bg-[#121212] dark:text-white ${
                fieldErrors.noteText
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                  : "border-gray-200 dark:border-[#2E2E2E]"
              }`}
            />
            {fieldErrors.noteText && (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                {fieldErrors.noteText}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => closeSidebarCommModal()}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-slate-700 dark:border-[#2E2E2E] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingNote}
                onClick={() => void handleSaveNote()}
                className="crm-btn-primary flex-1 inline-flex items-center justify-center gap-2"
              >
                {savingNote ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Note"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAccountInfo ? (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-[#2E2E2E]">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Client ID: <span className="font-mono">{accountInfo.id}</span>
          </p>
        </div>
      ) : null}

      <EditAppointmentModal
        open={editingReminder !== null}
        appointment={editingReminder}
        teamMembers={staffOptions}
        onClose={() => setEditingReminder(null)}
      />
    </aside>
  );
}
