"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Clock, Lock, RefreshCw } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { formatTime } from "@/lib/utils/date";
import {
  formatBatchCountdown,
  getNextBatchDate,
  wasBatchSentWithinDays,
} from "@/lib/packets/batch-window";

const BTN =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#8DE3B5] px-4 py-2.5 text-sm font-semibold text-[#0A2540] transition hover:bg-[#6BC99A] disabled:opacity-50 sm:w-auto";
const BTN_SM =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-[#8DE3B5] px-3 py-2 text-xs font-semibold text-[#0A2540] transition hover:bg-[#6BC99A] disabled:opacity-50";
const LAST_FEDEX_POLL_AT_KEY = "zb-fedex-last-poll-at";


export function FedexSentAwaitingSectionHeader(props?: { compact?: boolean }) {
  const compact = props?.compact ?? false;
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_FEDEX_POLL_AT_KEY);
      if (raw) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) {
          setLastChecked(formatTime(d));
        }
      }
    } catch {
      // private mode / unavailable
    }
  }, []);

  const handlePollAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/postlogic/poll-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await r.json()) as {
        error?: string;
        polled?: number;
        updated?: number;
        polledAt?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Poll failed");
      const at = j.polledAt ?? new Date().toISOString();
      try {
        localStorage.setItem(LAST_FEDEX_POLL_AT_KEY, at);
      } catch {
        // ignore
      }
      setLastChecked(formatTime(new Date()));
      toast.success(
        `Checked ${j.polled ?? 0} client(s); ${j.updated ?? 0} update(s)`
      );
      router.refresh();
    } catch (e) {
      toast.error(toUserFacingError(e instanceof Error ? e.message : "Poll failed"));
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  if (compact) {
    return (
      <div className="flex flex-col items-stretch gap-1 sm:items-end">
        <button
          type="button"
          onClick={() => void handlePollAll()}
          disabled={loading}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#8DE3B5] px-4 py-2.5 text-sm text-[#0A2540] transition-colors hover:bg-[#6BC99A] disabled:opacity-50 sm:w-auto"
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          {loading ? "Checking…" : "Check Tracking Updates"}
        </button>
        <p className="text-center text-xs text-gray-500 sm:text-right dark:text-slate-400">
          Auto-runs every 3 hours · Last checked: {lastChecked || "Never"}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        Sent — Awaiting Tracking
      </h2>
      <div className="flex w-full flex-col gap-1 sm:w-auto sm:items-end">
        <button
          type="button"
          onClick={() => void handlePollAll()}
          disabled={loading}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#8DE3B5] px-4 py-2.5 text-sm text-[#0A2540] transition-colors hover:bg-[#6BC99A] disabled:opacity-50 sm:w-auto"
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          {loading ? "Checking…" : "Check Tracking Updates"}
        </button>
        <p className="text-center text-xs text-gray-500 sm:text-right dark:text-slate-400">
          Auto-runs every 3 hours · Last checked: {lastChecked || "Never"}
        </p>
      </div>
    </div>
  );
}

export function FedexSendBatchButton({
  userRole,
  latestBatch,
}: {
  userRole: string;
  latestBatch: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showRestrictedModal, setShowRestrictedModal] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!showCountdown) return;
    const next = getNextBatchDate();
    const tick = () => setTimeLeft(formatBatchCountdown(next));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [showCountdown]);

  async function onSend() {
    if (wasBatchSentWithinDays(latestBatch, 2)) {
      setShowCountdown(true);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/postlogic/send-batch", { method: "POST" });
      const j = (await r.json()) as { error?: string; count?: number; message?: string };
      if (!r.ok) throw new Error(j.error ?? "Send failed");
      toast.success(j.message ?? `Sent ${j.count ?? 0} client(s) to print`);
      router.refresh();
    } catch (e) {
      toast.error(toUserFacingError(e instanceof Error ? e.message : "Send failed"));
    } finally {
      setLoading(false);
    }
  }

  if (userRole === "acct_manager") {
    return (
      <>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRestrictedModal(true)}
            className="flex cursor-not-allowed items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500 dark:bg-slate-700 dark:text-slate-400"
          >
            <Lock className="h-4 w-4 shrink-0" />
            Send Batch to Print
          </button>
        </div>
        {showRestrictedModal ? (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fedex-restricted-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowRestrictedModal(false);
            }}
          >
            <div
              className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:border dark:border-[#1a3550] dark:bg-[#0d2035]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
                <Lock className="h-6 w-6 text-red-500 dark:text-red-400" />
              </div>
              <h3
                id="fedex-restricted-title"
                className="mb-2 font-bold text-gray-900 dark:text-white"
              >
                Restricted Access
              </h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
                Batch submissions are processed by Admin only.
              </p>
              <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
                <p className="mb-1 text-xs font-semibold text-green-800 dark:text-green-300">
                  Next Batch Deadlines
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  Every Sunday & Wednesday at 8:00 PM Pacific
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRestrictedModal(false)}
                className="w-full rounded-xl bg-[#8DE3B5] py-2.5 text-sm font-medium text-[#0A2540]"
              >
                Got it
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <button type="button" className={BTN} disabled={loading} onClick={() => void onSend()}>
        {loading ? "Sending…" : "Send Batch to Print"}
      </button>
      {showCountdown ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCountdown(false);
          }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:border dark:border-[#1a3550] dark:bg-[#0d2035]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Next Batch Window
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  A batch was recently sent
                </p>
              </div>
            </div>
            <div className="mb-4 rounded-lg bg-slate-50 p-4 text-center dark:bg-[#071929]/60">
              <p className="font-mono text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                {timeLeft}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                until next send window
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCountdown(false)}
              className="crm-btn-secondary w-full text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function FedexSyncBatchIdsButton({
  batchId,
}: {
  batchId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncIds = useCallback(
    async (targetBatchId: string | null) => {
      if (!targetBatchId) return;
      setIsSyncing(true);
      try {
        const res = await fetch("/api/packets/sync-ids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId: targetBatchId }),
        });
        const data = (await res.json()) as {
          message?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Sync failed");
        toast.success(data.message || "Sync complete");
        router.refresh();
      } catch (e) {
        toast.error(
          toUserFacingError(e instanceof Error ? e.message : "Sync failed")
        );
      } finally {
        setIsSyncing(false);
      }
    },
    [router, toast]
  );

  return (
    <button
      type="button"
      onClick={() => void handleSyncIds(batchId)}
      disabled={isSyncing || !batchId}
      className="crm-btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 shrink-0 ${isSyncing ? "animate-spin" : ""}`}
      />
      {isSyncing ? "Syncing…" : "Sync IDs"}
    </button>
  );
}

function formatBatchHeaderDate(batchId: string): string {
  const d = new Date(`${batchId}T12:00:00`);
  if (Number.isNaN(d.getTime())) return batchId;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function FedexPacketsSentHeader({
  latestBatch,
}: {
  latestBatch: string | null;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Packets Sent
        </h3>
        {latestBatch ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Latest batch: {formatBatchHeaderDate(latestBatch)} · All in-flight batches shown
          </p>
        ) : null}
      </div>
      <FedexSyncBatchIdsButton batchId={latestBatch} />
    </div>
  );
}

export function FedexPacketsDeliveredHeader({
  secondBatch,
}: {
  secondBatch: string | null;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Packets Delivered
        </h3>
        {secondBatch ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Batch: {formatBatchHeaderDate(secondBatch)}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Waiting for second batch
          </p>
        )}
      </div>
      <FedexSyncBatchIdsButton batchId={secondBatch} />
    </div>
  );
}

export function FedexPostlogicIdField({
  clientId,
  initialValue,
}: {
  clientId: string;
  initialValue: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  async function onSave() {
    setSaving(true);
    try {
      const r = await fetch("/api/postlogic/unique-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          postlogic_unique_id: value.trim(),
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Save failed");
      toast.success("Print ID saved");
      router.refresh();
    } catch (e) {
      toast.error(toUserFacingError(e instanceof Error ? e.message : "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`postlogic-id-${clientId}`}>
        Print ID
      </label>
      <input
        id={`postlogic-id-${clientId}`}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. ZB0001"
        autoComplete="off"
        className="w-36 min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-mono text-slate-900 focus:border-[#8DE3B5] focus:outline-none focus:ring-1 focus:ring-[#8DE3B5]/40 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
      />
      <button
        type="button"
        className={BTN_SM}
        disabled={saving}
        onClick={onSave}
      >
        {saving ? "…" : "Save"}
      </button>
    </div>
  );
}
