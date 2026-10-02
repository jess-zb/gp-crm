"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  CreditCard,
  Droplets,
  Eye,
  FileText,
  FileUp,
  Link2,
  ListChecks,
  Loader2,
  Mail,
  MessageSquare,
  Mic,
  Package,
  Pencil,
  Phone,
  Pin,
  Printer,
  RefreshCw,
  Send,
  StickyNote,
  Trash2,
  Truck,
  Undo2,
  UserCheck,
} from "lucide-react";
import {
  deleteClientCommunication,
  editClientCommunication,
} from "./actions";
import { createClient } from "@/lib/supabase/client";
import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";
import { DictationMicButton } from "@/app/components/DictationMicButton";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import {
  applyMergeTags,
  type TemplateMergeContext,
} from "@/lib/comm-templates/merge-tags";
import { getActivityActionLabel } from "@/lib/clients/activity-feed";
import { laCalendarDayKey, laNowHm24, formatTimeAgo } from "@/lib/utils/date";

export type CommunicationListRow = {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  body: string | null;
  sent_at: string | null;
  duration_seconds: number | null;
  loggedByName: string | null;
  recorded_by: string | null;
  is_pinned: boolean;
};

type ModalKind = "call" | "sms" | "email" | "note";

type CommTemplateOption = {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
};

export type ClientActivityLogEntry = {
  id: string;
  action: string | null;
  new_value: unknown;
  performed_by_name: string | null;
  created_at: string;
};

const activityLogIconClass =
  "h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-slate-400";

function ActivityLogActionIcon({ action }: { action: string | null }) {
  const a = action ?? "";
  const c = activityLogIconClass;
  if (a === "stage_advanced") return <ArrowRight className={c} aria-hidden />;
  if (a === "stage_reverted") return <ArrowLeft className={c} aria-hidden />;
  if (a === "stage_auto_advanced" || a === "stage_changed") {
    return <RefreshCw className={c} aria-hidden />;
  }
  if (a === "client_reactivated") return <UserCheck className={c} aria-hidden />;
  if (a.endsWith("_assigned") || a === "self_assigned") {
    return <UserCheck className={c} aria-hidden />;
  }
  if (a === "document_uploaded" || a === "poa_uploaded") {
    return <FileUp className={c} aria-hidden />;
  }
  if (a === "audio_recording_uploaded") return <Mic className={c} aria-hidden />;
  if (a === "collection_letter_uploaded") {
    return <FileText className={c} aria-hidden />;
  }
  if (a === "note") return <StickyNote className={c} aria-hidden />;
  if (a === "call" || a === "call_auto_logged") return <Phone className={c} aria-hidden />;
  if (a === "email") return <Mail className={c} aria-hidden />;
  if (a === "sms" || a === "sms_auto_logged") {
    return <MessageSquare className={c} aria-hidden />;
  }
  if (a === "webhook_dedup_matched") return <Link2 className={c} aria-hidden />;
  if (a === "welcome_packet_queued") {
    return <Package className={c} aria-hidden />;
  }
  if (a === "welcome_packet_resent") return <Send className={c} aria-hidden />;
  if (a === "appointment_created") return <CalendarPlus className={c} aria-hidden />;
  if (a === "appointment_completed") {
    return <CalendarCheck className={c} aria-hidden />;
  }
  if (a === "appointment_deleted") return <CalendarX className={c} aria-hidden />;
  if (
    a === "client_cancelled" ||
    a === "client_moved_to_dnc" ||
    a === "client_dnc"
  ) {
    return <Ban className={c} aria-hidden />;
  }
  if (a === "client_archived") return <Archive className={c} aria-hidden />;
  if (a === "card_added" || a === "card_authorization_updated") {
    return <CreditCard className={c} aria-hidden />;
  }
  if (a === "checklist_completed" || a === "checklist_uncompleted") {
    return <ListChecks className={c} aria-hidden />;
  }
  if (a === "refund_requested" || a === "refund_processed") {
    return <Undo2 className={c} aria-hidden />;
  }
  if (a === "profile_reviewed" || a === "profile_review_cleared") {
    return <UserCheck className={c} aria-hidden />;
  }
  if (a === "client_record_viewed") return <Eye className={c} aria-hidden />;
  if (a === "drip_reset") return <Droplets className={c} aria-hidden />;
  if (a === "case_sent_to_attorneys") return <Send className={c} aria-hidden />;
  return <Activity className={c} aria-hidden />;
}

function defaultDateStr() {
  return laCalendarDayKey(new Date());
}

function defaultTimeStr() {
  return laNowHm24();
}

function bodyPreview(body: string | null, max = 150) {
  const b = body?.trim() ?? "";
  if (!b) return "—";
  return b.length > max ? `${b.slice(0, max)}…` : b;
}

function NoteBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(body.length <= 500);

  return (
    <div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words dark:text-slate-200">
        {expanded ? body : `${body.slice(0, 500)}…`}
      </p>
      {body.length > 500 ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-[#8DE3B5] hover:underline mt-1 dark:text-[#7fbf6f]"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

function typeEmoji(type: string) {
  switch (type) {
    case "call":
      return "📞";
    case "sms":
      return "💬";
    case "email":
      return "✉️";
    case "note":
      return "📝";
    default:
      return "📝";
  }
}

function typeIconClass(type: string) {
  switch (type) {
    case "call":
      return "text-blue-600 dark:text-blue-400";
    case "sms":
      return "text-green-600 dark:text-green-400";
    case "email":
      return "text-purple-600 dark:text-purple-400";
    case "note":
      return "text-slate-500 dark:text-slate-400";
    default:
      return "text-slate-500";
  }
}

function directionBadgeClass(direction: string) {
  if (direction === "inbound") {
    return "bg-teal-100 text-teal-900 ring-teal-600/20 dark:bg-teal-950/50 dark:text-teal-100 dark:ring-teal-500/30";
  }
  if (direction === "outbound") {
    return "bg-orange-100 text-orange-900 ring-orange-600/20 dark:bg-orange-950/50 dark:text-orange-100 dark:ring-orange-500/30";
  }
  return "bg-slate-200 text-slate-800 ring-slate-500/20 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-500/30";
}

function directionLabel(d: string) {
  if (d === "inbound") return "Inbound";
  if (d === "outbound") return "Outbound";
  if (d === "internal") return "Internal";
  return d;
}

const ACTION_BTN = "crm-btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5";

export function CommunicationsTab({
  clientId,
  initialRows,
  hasRingCentralAutoLog,
  activityLog,
  templateMergeContext,
  currentUserId,
  isAdminOrDev,
}: {
  clientId: string;
  initialRows: CommunicationListRow[];
  /** True when this client has at least one comm row with a RingCentral id */
  hasRingCentralAutoLog: boolean;
  activityLog: ClientActivityLogEntry[];
  templateMergeContext: TemplateMergeContext;
  currentUserId: string;
  isAdminOrDev: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingCommId, setEditingCommId] = useState<string | null>(null);
  const [editingCommBody, setEditingCommBody] = useState("");
  const [editCommSaving, setEditCommSaving] = useState(false);
  const [deletingCommId, setDeletingCommId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<CommTemplateOption[]>([]);
  const [emailTplId, setEmailTplId] = useState("");
  const [smsTplId, setSmsTplId] = useState("");

  const [dateStr, setDateStr] = useState(defaultDateStr);
  const [timeStr, setTimeStr] = useState(defaultTimeStr);
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");

  const [callNotes, setCallNotes] = useState("");

  const [smsMessage, setSmsMessage] = useState("");

  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const [noteBody, setNoteBody] = useState("");

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data, error } = await supabase
        .from("comm_templates")
        .select("id, name, type, subject, body")
        .order("name", { ascending: true });
      if (error) {
        console.error(error);
        return;
      }
      setTemplates((data ?? []) as CommTemplateOption[]);
    })();
  }, []);

  function openModal(kind: ModalKind) {
    setModal(kind);
    setFieldErrors({});
    setDateStr(defaultDateStr());
    setTimeStr(defaultTimeStr());
    setDirection("outbound");
    setCallNotes("");
    setSmsMessage("");
    setEmailSubject("");
    setEmailBody("");
    setNoteBody("");
    setEmailTplId("");
    setSmsTplId("");
  }

  const emailTemplates = templates.filter((t) => t.type === "email");
  const textTemplates = templates.filter((t) => t.type === "text");

  function applyEmailTemplate(id: string) {
    setEmailTplId(id);
    if (!id) return;
    const t = emailTemplates.find((x) => x.id === id);
    if (!t) return;
    setEmailSubject(applyMergeTags(t.subject ?? "", templateMergeContext));
    setEmailBody(applyMergeTags(t.body, templateMergeContext));
  }

  function applySmsTemplate(id: string) {
    setSmsTplId(id);
    if (!id) return;
    const t = textTemplates.find((x) => x.id === id);
    if (!t) return;
    setSmsMessage(applyMergeTags(t.body, templateMergeContext));
  }

  function closeModal() {
    setModal(null);
  }

  async function onSave() {
    if (!modal) return;

    setFieldErrors({});

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be signed in.");
      return;
    }

    let insert: Record<string, unknown>;
    const errors: Record<string, string> = {};

    if (modal === "call") {
      const notes = callNotes.trim();
      if (!notes) {
        errors.callNotes = "Notes are required.";
      }
      const localSent = new Date(`${dateStr}T${timeStr}:00`);
      if (Number.isNaN(localSent.getTime())) {
        errors.dateTime = "Invalid date or time.";
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      insert = {
        client_id: clientId,
        type: "call",
        direction,
        body: notes,
        duration_seconds: null,
        recorded_by: user.id,
        sent_at: localSent.toISOString(),
        subject: null,
      };
    } else if (modal === "sms") {
      const msg = smsMessage.trim();
      if (!msg) {
        errors.smsMessage = "Message is required.";
      }
      const localSent = new Date(`${dateStr}T${timeStr}:00`);
      if (Number.isNaN(localSent.getTime())) {
        errors.dateTime = "Invalid date or time.";
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      insert = {
        client_id: clientId,
        type: "sms",
        direction,
        body: msg,
        duration_seconds: null,
        recorded_by: user.id,
        sent_at: localSent.toISOString(),
        subject: null,
      };
    } else if (modal === "email") {
      const sub = emailSubject.trim();
      const body = emailBody.trim();
      if (!sub) {
        errors.emailSubject = "Subject is required.";
      }
      if (!body) {
        errors.emailBody = "Body is required.";
      }
      const localSent = new Date(`${dateStr}T${timeStr}:00`);
      if (Number.isNaN(localSent.getTime())) {
        errors.dateTime = "Invalid date or time.";
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      insert = {
        client_id: clientId,
        type: "email",
        direction,
        subject: sub,
        body,
        duration_seconds: null,
        recorded_by: user.id,
        sent_at: localSent.toISOString(),
      };
    } else {
      const note = noteBody.trim();
      if (!note) {
        errors.noteBody = "Note is required.";
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      insert = {
        client_id: clientId,
        type: "note",
        direction: "internal",
        body: note,
        duration_seconds: null,
        recorded_by: user.id,
        sent_at: new Date().toISOString(),
        subject: null,
      };
    }

    setSaving(true);
    const { error } = await supabase.from("communications").insert(insert);
    setSaving(false);

    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }

    toast.success("Saved");
    closeModal();
    router.refresh();
    // optimistic: server refresh will sync real data
  }

  const [localRows, setLocalRows] = useState<CommunicationListRow[]>(initialRows);

  const rows = [...localRows].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    const ta = new Date(a.sent_at ?? 0).getTime();
    const tb = new Date(b.sent_at ?? 0).getTime();
    return tb - ta;
  });

  async function handleTogglePin(commId: string) {
    const row = localRows.find((r) => r.id === commId);
    if (!row) return;
    const newPinned = !row.is_pinned;
    setLocalRows((prev) =>
      prev.map((r) => (r.id === commId ? { ...r, is_pinned: newPinned } : r))
    );
    const supabase = createClient();
    const { data, error } = await supabase
      .from("communications")
      .update({ is_pinned: newPinned })
      .eq("id", commId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      setLocalRows((prev) =>
        prev.map((r) => (r.id === commId ? { ...r, is_pinned: !newPinned } : r))
      );
      toast.error("Failed to update pin");
    }
  }

  async function handleDeleteComm(commId: string) {
    setDeletingCommId(commId);
    const result = await deleteClientCommunication(clientId, commId);
    if (!result.ok) {
      toast.error(result.error);
      setDeletingCommId(null);
      return;
    }
    setLocalRows((prev) => prev.filter((r) => r.id !== commId));
    setDeletingCommId(null);
    router.refresh();
  }

  async function handleSaveEditComm(commId: string) {
    if (!editingCommBody.trim()) return;
    setEditCommSaving(true);
    const result = await editClientCommunication(clientId, commId, editingCommBody);
    setEditCommSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLocalRows((prev) =>
      prev.map((r) => r.id === commId ? { ...r, body: editingCommBody.trim() } : r)
    );
    setEditingCommId(null);
    setEditingCommBody("");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
      <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
        Communications
      </h3>

      <div className="mb-8 flex flex-wrap gap-2">
        <button type="button" className={ACTION_BTN} onClick={() => openModal("call")}>
          <span aria-hidden>📞</span> Add Call
        </button>
        <button type="button" className={ACTION_BTN} onClick={() => openModal("sms")}>
          <span aria-hidden>💬</span> Add Text
        </button>
        <button type="button" className={ACTION_BTN} onClick={() => openModal("email")}>
          <span aria-hidden>✉️</span> Add Email
        </button>
        <button type="button" className={ACTION_BTN} onClick={() => openModal("note")}>
          <span aria-hidden>📝</span> Add Note
        </button>
      </div>
      {hasRingCentralAutoLog ? (
        <p className="mb-8 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          ✓ RingCentral auto-logging active
        </p>
      ) : null}

      {!rows.length ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-[#1a3550] dark:text-slate-400">
          No communications logged yet. Use the buttons above to log calls, texts, emails, or internal notes for this client.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((c) => (
            <li
              key={c.id}
              className={`group rounded-lg border p-4 ${
                c.is_pinned
                  ? "border-amber-300 bg-amber-50/60 dark:border-amber-700/50 dark:bg-amber-950/20"
                  : "border-slate-200 bg-slate-50/80 dark:border-[#1a3550] dark:bg-[#0d2035]/80"
              }`}
            >
              <div className="flex gap-3">
                <span
                  className={`shrink-0 text-2xl leading-none ${typeIconClass(c.type)}`}
                  aria-hidden
                >
                  {typeEmoji(c.type)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${directionBadgeClass(c.direction)}`}
                    >
                      {directionLabel(c.direction)}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      <ClientFormattedDate iso={c.sent_at} />
                    </span>
                    {c.is_pinned ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-300/60 dark:bg-amber-950/50 dark:text-amber-400 dark:ring-amber-700/40">
                        <Pin className="h-2.5 w-2.5 fill-current" aria-hidden /> Pinned
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Logged by{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {c.loggedByName?.trim() || "System"}
                    </span>
                  </p>
                  {c.type === "email" && c.subject?.trim() ? (
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {c.subject}
                    </p>
                  ) : null}
                  {c.type === "note" ? (
                    <div className="mt-1">
                      {editingCommId === c.id ? (
                        <div className="space-y-2">
                          <textarea
                            className="crm-input min-h-[80px] resize-y text-sm"
                            value={editingCommBody}
                            onChange={(e) => setEditingCommBody(e.target.value)}
                            disabled={editCommSaving}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={editCommSaving || !editingCommBody.trim()}
                              onClick={() => void handleSaveEditComm(c.id)}
                              className="rounded-md bg-[#8DE3B5] px-3 py-1 text-xs font-semibold text-[#0A2540] hover:bg-[#6BC99A] disabled:opacity-50"
                            >
                              {editCommSaving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              disabled={editCommSaving}
                              onClick={() => { setEditingCommId(null); setEditingCommBody(""); }}
                              className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1a3550] dark:text-slate-300 dark:hover:bg-[#102840]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <NoteBody body={c.body ?? ""} />
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {bodyPreview(c.body)}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3">
                    {c.type === "note" && (c.recorded_by === currentUserId || isAdminOrDev) && editingCommId !== c.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setEditingCommId(c.id); setEditingCommBody(c.body ?? ""); }}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingCommId === c.id}
                          onClick={() => void handleDeleteComm(c.id)}
                          className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                        >
                          {deletingCommId === c.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          {deletingCommId === c.id ? "Deleting…" : "Delete"}
                        </button>
                      </>
                    ) : null}
                    {editingCommId !== c.id ? (
                      <button
                        type="button"
                        onClick={() => void handleTogglePin(c.id)}
                        className={`inline-flex items-center gap-1 text-xs transition-opacity ${
                          c.is_pinned
                            ? "text-amber-500 opacity-100 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                            : "text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-500 dark:hover:text-amber-400"
                        }`}
                        title={c.is_pinned ? "Unpin" : "Pin to top"}
                        aria-label={c.is_pinned ? "Unpin" : "Pin to top"}
                      >
                        <Pin className={`h-3 w-3 ${c.is_pinned ? "fill-current" : ""}`} aria-hidden />
                        {c.is_pinned ? "Unpin" : "Pin"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 border-t border-gray-100 pt-6 dark:border-[#1a3550]">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Activity Log
        </h3>
        {activityLog.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-base font-medium text-slate-700 dark:text-slate-300">
              No activity recorded yet
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Notes and system events will appear here once you log a call, text, or email.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-[#1a3550]/60">
            {activityLog.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-[#102840]">
                    <ActivityLogActionIcon action={entry.action} />
                  </span>
                  <span className="truncate text-sm font-medium text-gray-800 dark:text-slate-100">
                    {getActivityActionLabel(entry.action)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
                  <span className="max-w-[8rem] truncate">
                    {entry.performed_by_name?.trim() || "System"}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="whitespace-nowrap">{formatTimeAgo(entry.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) closeModal();
          }}
        >
          <div
            className="mx-auto max-h-[90vh] w-full max-w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 dark:border-[#1a3550] dark:bg-[#0d2035]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comm-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              id="comm-modal-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              {modal === "call"
                ? "Add Call"
                : modal === "sms"
                  ? "Add Text"
                  : modal === "email"
                    ? "Add Email"
                    : "Add Note"}
            </h4>

            <div className="mt-4 space-y-4">
              {modal !== "note" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="block text-sm">
                      <label
                        htmlFor="comm-date"
                        className="font-medium text-slate-700 dark:text-slate-300"
                      >
                        Date
                      </label>
                      <input
                        id="comm-date"
                        type="date"
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:bg-[#071929] dark:text-[#E8EAEE] ${
                          fieldErrors.dateTime
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                            : "border-slate-200 dark:border-[#1a3550]"
                        }`}
                      />
                    </div>
                    <div className="block text-sm">
                      <label
                        htmlFor="comm-time"
                        className="font-medium text-slate-700 dark:text-slate-300"
                      >
                        Time
                      </label>
                      <input
                        id="comm-time"
                        type="time"
                        value={timeStr}
                        onChange={(e) => setTimeStr(e.target.value)}
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:bg-[#071929] dark:text-[#E8EAEE] ${
                          fieldErrors.dateTime
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                            : "border-slate-200 dark:border-[#1a3550]"
                        }`}
                      />
                    </div>
                  </div>
                  {fieldErrors.dateTime ? (
                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {fieldErrors.dateTime}
                    </p>
                  ) : null}

                  <fieldset>
                    <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Direction
                    </legend>
                    <div className="flex gap-6">
                      <label
                        htmlFor="dir-inbound"
                        className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200"
                      >
                        <input
                          id="dir-inbound"
                          type="radio"
                          name="comm-direction"
                          checked={direction === "inbound"}
                          onChange={() => setDirection("inbound")}
                          className="h-4 w-4 border-slate-300 text-[#8DE3B5] focus:ring-[#8DE3B5]"
                        />
                        Inbound
                      </label>
                      <label
                        htmlFor="dir-outbound"
                        className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200"
                      >
                        <input
                          id="dir-outbound"
                          type="radio"
                          name="comm-direction"
                          checked={direction === "outbound"}
                          onChange={() => setDirection("outbound")}
                          className="h-4 w-4 border-slate-300 text-[#8DE3B5] focus:ring-[#8DE3B5]"
                        />
                        Outbound
                      </label>
                    </div>
                  </fieldset>
                </>
              ) : null}

              {modal === "call" ? (
                <>
                  <div className="block text-sm">
                    <label
                      htmlFor="call-notes"
                      className="font-medium text-slate-700 dark:text-slate-300"
                    >
                      Notes <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="call-notes"
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      rows={5}
                      required
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:bg-[#071929] dark:text-[#E8EAEE] ${
                        fieldErrors.callNotes
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                          : "border-slate-200 dark:border-[#1a3550]"
                      }`}
                      placeholder="Call notes…"
                    />
                  </div>
                  {fieldErrors.callNotes ? (
                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {fieldErrors.callNotes}
                    </p>
                  ) : null}
                </>
              ) : null}

              {modal === "sms" ? (
                <>
                  <div className="block text-sm">
                    <label
                      htmlFor="sms-template"
                      className="font-medium text-slate-700 dark:text-slate-300"
                    >
                      Use template
                    </label>
                    <select
                      id="sms-template"
                      value={smsTplId}
                      onChange={(e) => applySmsTemplate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-[#1a3550] dark:bg-[#071929] dark:text-[#E8EAEE]"
                    >
                      <option value="">— None —</option>
                      {textTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="block text-sm">
                    <label
                      htmlFor="sms-message"
                      className="font-medium text-slate-700 dark:text-slate-300"
                    >
                      Message <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="sms-message"
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      rows={5}
                      required
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:bg-[#071929] dark:text-[#E8EAEE] ${
                        fieldErrors.smsMessage
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                          : "border-slate-200 dark:border-[#1a3550]"
                      }`}
                      placeholder="Text message…"
                    />
                  </div>
                  {fieldErrors.smsMessage ? (
                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {fieldErrors.smsMessage}
                    </p>
                  ) : null}
                </>
              ) : null}

              {modal === "email" ? (
                <>
                  <div className="block text-sm">
                    <label
                      htmlFor="email-template"
                      className="font-medium text-slate-700 dark:text-slate-300"
                    >
                      Use template
                    </label>
                    <select
                      id="email-template"
                      value={emailTplId}
                      onChange={(e) => applyEmailTemplate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-[#1a3550] dark:bg-[#071929] dark:text-[#E8EAEE]"
                    >
                      <option value="">— None —</option>
                      {emailTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="block text-sm">
                    <label
                      htmlFor="email-subject"
                      className="font-medium text-slate-700 dark:text-slate-300"
                    >
                      Subject
                    </label>
                    <input
                      id="email-subject"
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:bg-[#071929] dark:text-[#E8EAEE] ${
                        fieldErrors.emailSubject
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                          : "border-slate-200 dark:border-[#1a3550]"
                      }`}
                      placeholder="Subject"
                    />
                  </div>
                  {fieldErrors.emailSubject ? (
                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {fieldErrors.emailSubject}
                    </p>
                  ) : null}
                  <div className="block text-sm">
                    <label
                      htmlFor="email-body"
                      className="font-medium text-slate-700 dark:text-slate-300"
                    >
                      Body <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="email-body"
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={6}
                      required
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:bg-[#071929] dark:text-[#E8EAEE] ${
                        fieldErrors.emailBody
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                          : "border-slate-200 dark:border-[#1a3550]"
                      }`}
                      placeholder="Email body…"
                    />
                  </div>
                  {fieldErrors.emailBody ? (
                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {fieldErrors.emailBody}
                    </p>
                  ) : null}
                </>
              ) : null}

              {modal === "note" ? (
                <div className="block text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <label
                      htmlFor="note-body"
                      className="pt-2 font-medium text-slate-700 dark:text-slate-300"
                    >
                      Note <span className="text-red-600">*</span>
                    </label>
                    <DictationMicButton
                      value={noteBody}
                      onChange={setNoteBody}
                      disabled={saving}
                    />
                  </div>
                  <textarea
                    id="note-body"
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    rows={6}
                    required
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:bg-[#071929] dark:text-[#E8EAEE] ${
                      fieldErrors.noteBody
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                        : "border-slate-200 dark:border-[#1a3550]"
                    }`}
                    placeholder="Internal note, or click Dictate to speak it…"
                  />
                  {fieldErrors.noteBody ? (
                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {fieldErrors.noteBody}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="crm-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave()}
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
          </div>
        </div>
      ) : null}
    </section>
  );
}
