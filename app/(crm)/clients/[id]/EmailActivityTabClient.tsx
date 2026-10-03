"use client";

import { useState, useEffect } from "react";
import { Loader2, Mail, Plus, RefreshCw, Clock, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import type { UpcomingEmailRow } from "@/lib/email/upcoming-for-client";
import { toggleSequenceStepSkipServerAction } from "./stage-entry-actions";

type EmailLog = {
  id: string;
  sequence_id: string | null;
  step: number | null;
  subject: string | null;
  status: string | null;
  sent_at: string | null;
  error: string | null;
};

type Enrollment = {
  id: string;
  sequence_key: string | null;
  status: string;
  enrolled_at: string;
  next_send_at: string | null;
  last_step_sent: number | null;
};

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  opened: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  clicked: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  bounced: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  complained: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const SEQUENCE_NAMES: Record<string, string> = {
  welcome_lead: "Welcome – New Lead",
  welcome_cs: "Welcome – Client Services",
  active_arc: "Active Arc (1–7)",
  partial_arc: "Partial Arc (1–4)",
  case_referred: "Case Sent to Attorneys",
  follow_up_24hr: "Follow Up – 24hr",
  holiday: "Holiday",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUpcomingWhen(scheduledIso: string): string {
  const target = new Date(scheduledIso);
  if (Number.isNaN(target.getTime())) return "—";
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(diffMs / dayMs);
  if (diffMs <= 0) return "Sending now";
  if (diffDays === 0) {
    const hrs = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
    return hrs === 1 ? "In 1 hour" : `In ${hrs} hours`;
  }
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 14) return `In ${diffDays} days`;
  if (diffDays < 60) {
    const wks = Math.round(diffDays / 7);
    return `In ${wks} week${wks === 1 ? "" : "s"}`;
  }
  const mos = Math.round(diffDays / 30);
  return `In ${mos} month${mos === 1 ? "" : "s"}`;
}

export function EmailActivityTabClient({
  clientId,
  userRole: _userRole,
  performerName,
  upcomingEmails,
  stage: _stage,
}: {
  clientId: string;
  userRole: string;
  performerName: string;
  upcomingEmails: UpcomingEmailRow[];
  stage: string | null;
}) {
  const toast = useToast();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetScope, setResetScope] = useState("all");
  const [busy, setBusy] = useState(false);
  const [localUpcoming, setLocalUpcoming] = useState<UpcomingEmailRow[]>(upcomingEmails);
  const [skipBusyKey, setSkipBusyKey] = useState<string | null>(null);

  useEffect(() => {
    setLocalUpcoming(upcomingEmails);
  }, [upcomingEmails]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const [{ data: logsData, error: logsErr }, { data: enrollData, error: enrollErr }] = await Promise.all([
        supabase
          .from("email_logs")
          .select("id, sequence_id, step, subject, status, sent_at, error")
          .eq("client_id", clientId)
          .order("sent_at", { ascending: false })
          .limit(50),
        supabase
          .from("sequence_enrollments")
          .select("id, sequence_key, status, enrolled_at, next_send_at, last_step_sent")
          .eq("client_id", clientId)
          .order("enrolled_at", { ascending: false })
          .limit(20),
      ]);

      if (logsErr) console.error("[Drips] email_logs error:", logsErr);
      if (enrollErr) console.error("[Drips] sequence_enrollments error:", enrollErr);

      if (!cancelled) {
        setLogs((logsData ?? []) as EmailLog[]);
        setEnrollments((enrollData ?? []) as Enrollment[]);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function handleResetDrip() {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not signed in.");
      setBusy(false);
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from("audit_log").insert({
      client_id: clientId,
      action: "drip_reset",
      new_value: { reset_by: performerName, reset_at: now, scope: resetScope },
      performed_by: user.id,
      performed_by_name: performerName,
    });
    setBusy(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    toast.success("Drip reset logged — re-save client status to re-enroll");
    setShowResetModal(false);
  }

  async function handleToggleUpcomingSkip(row: UpcomingEmailRow) {
    const key = `${row.enrollmentId}:${row.stepOrder}`;
    setSkipBusyKey(key);
    const previous = localUpcoming;
    setLocalUpcoming((prev) =>
      prev.map((r) =>
        r.enrollmentId === row.enrollmentId && r.stepOrder === row.stepOrder
          ? { ...r, isSkipped: !r.isSkipped }
          : r
      )
    );
    try {
      const res = await toggleSequenceStepSkipServerAction({
        clientId,
        enrollmentId: row.enrollmentId,
        stepOrder: row.stepOrder,
      });
      if (!res.ok) {
        setLocalUpcoming(previous);
        toast.error(toUserFacingError(res.error));
        return;
      }
      toast.success(res.skipped ? "Email skipped" : "Email re-enabled");
    } catch (err) {
      setLocalUpcoming(previous);
      toast.error(
        toUserFacingError(err instanceof Error ? err.message : "Failed to update")
      );
    } finally {
      setSkipBusyKey(null);
    }
  }

  const activeEnrollments = enrollments.filter((e) => e.status === "active");

  return (
    <section className="space-y-4">
      {/* Active Campaigns */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Active Campaigns
        </h3>
        {loading ? (
          <div className="py-6 text-center text-sm text-gray-400 dark:text-slate-500">
            Loading…
          </div>
        ) : activeEnrollments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-[#2E2E2E] dark:text-slate-400">
            No active campaigns. Set or re-save the client's stage to trigger an enrollment.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeEnrollments.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-[#121212]"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0 text-[#A87830]" />
                  <span className="text-sm font-medium text-gray-800 dark:text-slate-200">
                    {SEQUENCE_NAMES[e.sequence_key ?? ""] ?? e.sequence_key ?? "Unknown"}
                  </span>
                  {(e.last_step_sent ?? 0) > 0 && (
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      · Step {e.last_step_sent} sent
                    </span>
                  )}
                </div>
                {e.next_send_at && (
                  <span className="whitespace-nowrap text-xs text-gray-400 dark:text-slate-500">
                    Next: {fmtDate(e.next_send_at)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Upcoming Emails */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Upcoming Emails
          </h3>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Drip queue
          </span>
        </div>
        {!localUpcoming.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 dark:border-[#2E2E2E] dark:text-slate-400">
            No drip emails queued. Emails will appear here when this client's stage triggers a sequence.
          </p>
        ) : (
          <ul className="space-y-2">
            {localUpcoming.map((row) => {
              const key = `${row.enrollmentId}:${row.stepOrder}`;
              const skipBusy = skipBusyKey === key;
              return (
                <li
                  key={key}
                  className={`group flex items-start gap-2 rounded-lg border p-2.5 text-left transition ${
                    row.isSkipped
                      ? "border-slate-200 bg-slate-50 opacity-60 dark:border-[#2E2E2E] dark:bg-[#121212]/40"
                      : "border-slate-100 bg-white hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#121212]/40 dark:hover:bg-[#242424]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`break-words text-xs font-medium ${
                        row.isSkipped
                          ? "text-slate-500 line-through dark:text-slate-500"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {row.subject}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-slate-600 dark:bg-[#242424] dark:text-slate-300">
                        {row.sequenceLabel} {row.stepOrder}
                      </span>
                      <span>·</span>
                      <span>{row.isSkipped ? "Skipped" : formatUpcomingWhen(row.scheduledFor)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={skipBusy}
                    onClick={() => void handleToggleUpcomingSkip(row)}
                    title={row.isSkipped ? "Re-enable this email" : "Skip this email"}
                    aria-label={row.isSkipped ? "Re-enable this email" : "Skip this email"}
                    className={`shrink-0 rounded p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] ${
                      row.isSkipped
                        ? "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#242424] dark:hover:text-slate-300"
                        : "text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                    }`}
                  >
                    {skipBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : row.isSkipped ? (
                      <Plus className="h-3.5 w-3.5" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Email Log */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Email Log
          </h3>
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-orange-400 px-3 py-1.5 text-xs text-orange-500 transition-colors hover:bg-orange-50 dark:border-orange-500/70 dark:text-orange-400 dark:hover:bg-orange-950/30"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Drip
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">
            Loading…
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-green-50 dark:bg-emerald-950/40">
              <Mail className="h-7 w-7 text-[#A87830]" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-slate-300">No emails sent yet</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
              Emails will appear here once the sequence starts sending.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
            {logs.map((log) => {
              const statusStyle =
                STATUS_STYLES[log.status ?? ""] ??
                "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
              const statusLabel =
                log.status
                  ? log.status.charAt(0).toUpperCase() + log.status.slice(1)
                  : "Unknown";

              return (
                <li key={log.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-[#121212]">
                    <Mail className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-gray-800 dark:text-slate-200">
                        {log.subject ?? "—"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
                      <span>
                        {SEQUENCE_NAMES[log.sequence_id ?? ""] ?? log.sequence_id ?? "—"}
                      </span>
                      {log.step != null && <span>· Step {log.step}</span>}
                      <span>· {fmtDateTime(log.sent_at)}</span>
                    </div>
                    {log.error && (
                      <p className="mt-0.5 text-xs text-red-500 dark:text-red-400">{log.error}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Reset modal */}
      {showResetModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            if (!busy) setShowResetModal(false);
          }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:border dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
              Reset Drip Campaign
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
              This logs a reset event. To restart a sequence, re-save the client&apos;s stage after
              resetting — the trigger will re-enroll them automatically.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                Which drip?
              </label>
              <select
                value={resetScope}
                onChange={(e) => setResetScope(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
              >
                <option value="all">All active drips</option>
                <option value="welcome_lead">Welcome – Lead</option>
                <option value="welcome_cs">Welcome – Client Services</option>
                <option value="active_arc">Active 1–7</option>
                <option value="partial_arc">Partial 1–4</option>
                <option value="case_referred">Case Referred</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowResetModal(false)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-slate-700 dark:border-[#2E2E2E] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleResetDrip()}
                className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Working…" : "Reset & Restart"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
