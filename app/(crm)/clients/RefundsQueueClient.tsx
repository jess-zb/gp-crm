"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toUserFacingError } from "@/lib/user-facing-error";
import { formatMoneyUsdFromCents } from "@/lib/utils/format";
import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";
import type { TabCounts } from "@/lib/clients/tab-counts";
import type { ClientsPageTab } from "@/lib/clients/clients-tabs";
import type { RefundRow, RefundsQueueResult } from "@/lib/refunds/refunds-query";
import { BoardSearchInput } from "./BoardSearchInput";
import { ClientsTabRow } from "./ClientsTabRow";
import {
  markRefundDenied,
  markRefundRefunded,
  recordRefundOffsetBilling,
} from "./refund-actions";

/** Pending refunds get louder the longer they sit. */
function daysPendingClass(days: number | null): string {
  if (days === null) return "text-slate-400 dark:text-slate-500";
  if (days >= 14) return "font-semibold text-red-700 dark:text-red-300";
  if (days >= 7) return "font-medium text-amber-700 dark:text-amber-300";
  return "text-slate-600 dark:text-slate-300";
}

function daysPendingLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Today";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function RefundsQueueClient({
  queue,
  counts,
  role,
  isDevViewer,
}: {
  queue: RefundsQueueResult;
  counts: TabCounts;
  role: string;
  /** Dev-only usage panel. */
  isDevViewer: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showUsage, setShowUsage] = useState(false);
  const [query, setQuery] = useState("");

  const filtering = query.trim().length > 0;

  const matches = useCallback(
    (row: RefundRow) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [row.clientName, row.processorLabel, row.requestedByName]
        .filter((v): v is string => !!v)
        .some((v) => v.toLowerCase().includes(q));
    },
    [query]
  );

  // Filters in place — the queue is small and already loaded. Each group keeps
  // its float figures, which describe the MID rather than what is on screen, so
  // the advisory math stays correct while searching.
  const visibleGroups = useMemo(
    () =>
      queue.groups
        .map((group) => ({ ...group, visibleRows: group.rows.filter(matches) }))
        .filter((group) => group.visibleRows.length > 0),
    [queue.groups, matches]
  );

  const visiblePendingCount = useMemo(
    () => visibleGroups.reduce((sum, g) => sum + g.visibleRows.length, 0),
    [visibleGroups]
  );

  const visibleRefundedToday = useMemo(
    () => queue.refundedToday.filter(matches),
    [queue.refundedToday, matches]
  );

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    if (busyId) return;
    setBusyId(id);
    try {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } catch (error) {
      toast.error(toUserFacingError(error));
    } finally {
      setBusyId(null);
    }
  }

  function onMarkRefunded(row: RefundRow) {
    void run(row.id, async () => {
      const result = await markRefundRefunded(row.id);
      if (result.ok) {
        toast.success(
          `Marked ${formatMoneyUsdFromCents(row.amountCents)} refunded for ${row.clientName}.`
        );
      }
      return result;
    });
  }

  function onDeny(row: RefundRow) {
    if (
      !window.confirm(
        `Mark the refund request for ${row.clientName} as denied? The client stays cancelled.`
      )
    ) {
      return;
    }
    void run(row.id, () => markRefundDenied(row.id));
  }

  function onToggleOffset(row: RefundRow) {
    const billed = !row.offsetBilledAt;
    void run(row.id, () =>
      recordRefundOffsetBilling(row.id, billed, billed ? row.amountCents : undefined)
    );
  }

  return (
    <>
      <BoardSearchInput
        id="refunds-search"
        label="Search refunds"
        placeholder="Search client, processor / MID, requested by…"
        value={query}
        onChange={setQuery}
      />

      <ClientsTabRow
        activeTab={"refunds" as ClientsPageTab}
        counts={counts}
        role={role}
      />

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {filtering
            ? `${visiblePendingCount} of ${queue.pendingCount} awaiting processing`
            : `${queue.pendingCount} awaiting processing`}{" "}
          · {formatMoneyUsdFromCents(queue.pendingCents)} queued ·{" "}
          {filtering
            ? `${visibleRefundedToday.length} of ${queue.refundedToday.length} processed today`
            : `${queue.refundedToday.length} processed today`}
        </p>
        {isDevViewer ? (
          <button
            type="button"
            onClick={() => setShowUsage((p) => !p)}
            className="crm-btn-secondary"
          >
            {showUsage ? "Hide" : "Show"} usage
          </button>
        ) : null}
      </div>

      {queue.error ? (
        <p className="mt-4 text-sm text-red-600">{queue.error}</p>
      ) : null}

      {isDevViewer && showUsage ? (
        <div className="mt-4 grid gap-4 rounded-xl border border-gray-200 p-4 md:grid-cols-3 dark:border-[#2E2E2E]">
          {[
            { title: "Requested by", entries: queue.usage.requestedBy },
            { title: "Processed by", entries: queue.usage.refundedBy },
            { title: "By processor", entries: queue.usage.byProcessor },
          ].map((panel) => (
            <div key={panel.title}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {panel.title} · last {queue.usage.windowDays}d
              </p>
              {panel.entries.length === 0 ? (
                <p className="text-sm text-slate-400">No activity</p>
              ) : (
                <ul className="space-y-1">
                  {panel.entries.map((entry) => (
                    <li
                      key={entry.name}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-slate-700 dark:text-slate-200">
                        {entry.name}
                      </span>
                      <span className="shrink-0 text-slate-500 dark:text-slate-400">
                        {entry.count} · {formatMoneyUsdFromCents(entry.totalCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {visibleGroups.length === 0 ? (
        <div className="mt-4 rounded-xl border border-gray-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-[#2E2E2E] dark:text-slate-400">
          {filtering
            ? `No queued refunds match "${query.trim()}".`
            : "No refunds are awaiting processing."}
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {visibleGroups.map((group) => (
            <section
              key={group.processorLabel}
              className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#2E2E2E]"
            >
              <header className="flex flex-col gap-2 border-b border-gray-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {group.processorLabel}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {filtering
                      ? `${group.visibleRows.length} of ${group.rows.length} queued`
                      : `${group.rows.length} queued`}{" "}
                    ·{" "}
                    {formatMoneyUsdFromCents(group.float.queuedCents)} · processed
                    today {formatMoneyUsdFromCents(group.float.processedTodayCents)}
                  </p>
                </div>
                {group.float.overFloat ? (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-500/25 dark:bg-amber-950/30 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {formatMoneyUsdFromCents(group.float.shortfallCents)} over the{" "}
                      {formatMoneyUsdFromCents(group.float.floatCents)} float. Bill
                      on this MID today to avoid refund fees.
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Within the {formatMoneyUsdFromCents(group.float.floatCents)}{" "}
                    float.
                  </p>
                )}
              </header>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-left dark:border-[#2E2E2E]">
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Client
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Requested
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Pending
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Offset billed
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.visibleRows.map((row) => {
                      const busy = busyId === row.id;
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 last:border-b-0 dark:border-[#2E2E2E]"
                        >
                          <td className="px-4 py-2.5 align-middle">
                            <Link
                              href={`/clients/${row.clientId}`}
                              className="text-sm font-medium text-[#A87830] hover:text-[#8C6428] dark:hover:text-[#C4A15A]"
                            >
                              {row.clientName}
                            </Link>
                            {row.needsReview ? (
                              <span className="ml-2 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-inset ring-amber-500/25 dark:bg-amber-950/40 dark:text-amber-100">
                                Needs review
                              </span>
                            ) : null}
                            {row.notes ? (
                              <p className="mt-0.5 max-w-[280px] truncate text-xs text-slate-500 dark:text-slate-400">
                                {row.notes}
                              </p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right align-middle text-sm font-medium text-slate-800 dark:text-slate-100">
                            {formatMoneyUsdFromCents(row.amountCents)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 align-middle text-sm text-slate-600 dark:text-slate-300">
                            <ClientFormattedDate
                              iso={row.requestedAt}
                              pattern="MMM d, yyyy"
                            />
                            {row.requestedByName ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {row.requestedByName}
                              </p>
                            ) : null}
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-2.5 align-middle text-sm ${daysPendingClass(row.daysPending)}`}
                          >
                            {daysPendingLabel(row.daysPending)}
                          </td>
                          <td className="px-4 py-2.5 text-center align-middle">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-[#A87830] focus:ring-[#A87830]"
                              checked={!!row.offsetBilledAt}
                              disabled={busy}
                              onChange={() => onToggleOffset(row)}
                              aria-label={`Offset billing recorded for ${row.clientName}`}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right align-middle">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onDeny(row)}
                                disabled={busy}
                                className="crm-btn-secondary"
                              >
                                Deny
                              </button>
                              <button
                                type="button"
                                onClick={() => onMarkRefunded(row)}
                                disabled={busy}
                                className="crm-btn-primary inline-flex items-center gap-1.5"
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Mark Refunded
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {visibleRefundedToday.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Processed today
          </h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-gray-200 dark:divide-[#2E2E2E] dark:border-[#2E2E2E]">
            {visibleRefundedToday.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <Link
                  href={`/clients/${row.clientId}`}
                  className="font-medium text-[#A87830] hover:text-[#8C6428] dark:hover:text-[#C4A15A]"
                >
                  {row.clientName}
                </Link>
                <span className="text-slate-600 dark:text-slate-300">
                  {formatMoneyUsdFromCents(row.amountCents)} · {row.processorLabel}
                  {row.refundedByName ? ` · ${row.refundedByName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-4 text-[13px] text-slate-500 dark:text-slate-400">
        The float warning is advisory. Refunds always record, whatever the amount.
      </p>
    </>
  );
}
