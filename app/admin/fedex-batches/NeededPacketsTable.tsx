"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { PacketNeededRow } from "./packet-manager-types";
import type { NeededSortField, SortDir } from "@/lib/packets/shipment-sort";
import { packetsNeededDateMs } from "@/lib/packets/shipment-sort";
import { getAddressWarning } from "@/lib/utils/address-validation";

function NeededSortableHeader({
  field,
  label,
  current,
  dir,
  onSort,
}: {
  field: NeededSortField;
  label: string;
  current: NeededSortField;
  dir: SortDir;
  onSort: (field: NeededSortField) => void;
}) {
  const active = field === current;
  return (
    <th
      className="cursor-pointer select-none pb-2 pr-3 font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#102840]"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="text-xs text-slate-400">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </div>
    </th>
  );
}

function formatDateQueued(c: PacketNeededRow): string {
  const ms = packetsNeededDateMs(c);
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const BASE_COL_COUNT = 6;

export function NeededPacketsTable({
  rows,
  emptyMessage,
  sortField,
  sortDir,
  onSort,
  fullName,
  formatAddress,
  assignedFullName,
  canExport,
  canEditMid,
  canManualSend,
  resolveMerchant,
  onSaveMid,
  midSaving,
  midOptions,
  onSkipSecondary,
  onManualSend,
  skipLoadingKey,
  manualSendLoadingKey,
}: {
  rows: PacketNeededRow[];
  emptyMessage: string;
  sortField: NeededSortField;
  sortDir: SortDir;
  onSort: (field: NeededSortField) => void;
  fullName: (c: PacketNeededRow) => string;
  formatAddress: (c: PacketNeededRow) => string;
  assignedFullName: (raw: PacketNeededRow["assigned_user"]) => string;
  canExport?: boolean;
  /** Edit the Merchant/MID on a row — open to all Packet Manager roles. */
  canEditMid?: boolean;
  /** Dev-role only: per-row Send to PostLogic. */
  canManualSend?: boolean;
  resolveMerchant: (c: PacketNeededRow) => string;
  onSaveMid?: (clientId: string, merchant: string) => Promise<void>;
  midSaving?: Set<string>;
  /** MID picker choices (built-in merchants + any crm_settings extras). */
  midOptions: readonly string[];
  onSkipSecondary?: (clientId: string) => Promise<void>;
  onManualSend?: (
    clientId: string,
    recipientType: "primary" | "secondary"
  ) => Promise<void>;
  skipLoadingKey?: string | null;
  manualSendLoadingKey?: string | null;
}) {
  const [editingMid, setEditingMid] = useState<string | null>(null);
  const [selectedMid, setSelectedMid] = useState("");
  const colCount = BASE_COL_COUNT + (canManualSend ? 1 : 0);

  const blockedCount = rows.filter((r) =>
    getAddressWarning(r.street_address)
  ).length;

  return (
    <div>
      {blockedCount > 0 ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {blockedCount} client{blockedCount > 1 ? "s" : ""} have address issues and
          will be skipped at batch time until fixed.
        </div>
      ) : null}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-[#1a3550]">
            <NeededSortableHeader
              field="recipient_name"
              label="Name"
              current={sortField}
              dir={sortDir}
              onSort={onSort}
            />
            <NeededSortableHeader
              field="advisor"
              label="Advisor"
              current={sortField}
              dir={sortDir}
              onSort={onSort}
            />
            <th className="pb-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">
              MID
            </th>
            <th className="pb-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">
              Address
            </th>
            <NeededSortableHeader
              field="phone"
              label="Phone"
              current={sortField}
              dir={sortDir}
              onSort={onSort}
            />
            <NeededSortableHeader
              field="batch_date"
              label="Date Created"
              current={sortField}
              dir={sortDir}
              onSort={onSort}
            />
            {canManualSend ? (
              <th className="pb-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colCount}
                className="py-8 text-center text-slate-500 dark:text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((c) => {
              const warning = getAddressWarning(c.street_address);
              const hasAddressIssue = warning !== null;
              const merchant = resolveMerchant(c);
              const isSaving = midSaving?.has(c.id);
              const isSecondary = c.recipient_type === "secondary";
              const rowKey = `${c.id}-${c.recipient_type}`;
              const skipKey = `${c.id}-secondary`;
              const isSkipping = isSecondary && skipLoadingKey === skipKey;
              const isSending = manualSendLoadingKey === rowKey;
              const hasMid = Boolean(merchant);
              return (
              <tr key={rowKey} className="border-b border-slate-100 dark:border-[#1a3550]">
                <td className="py-3 pr-3 font-medium text-slate-900 dark:text-slate-100">
                  <div className="flex items-center gap-2">
                    <Link href={`/clients/${c.id}`} className="text-[#8DE3B5] hover:underline">
                      {fullName(c)}
                    </Link>
                    {isSecondary ? (
                      <>
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                          Secondary
                        </span>
                        {canExport && onSkipSecondary ? (
                          <button
                            type="button"
                            disabled={isSkipping}
                            onClick={() => void onSkipSecondary(c.id)}
                            title="Skip this secondary recipient — they won't be sent a packet"
                            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-red-500 disabled:opacity-40 dark:hover:bg-[#102840]"
                            aria-label="Skip secondary recipient"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </td>
                <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">
                  {assignedFullName(c.assigned_user)}
                </td>
                <td className="py-2 pr-3 align-top">
                  {isSaving ? (
                    <span className="text-xs text-slate-400">Saving…</span>
                  ) : merchant ? (
                    <span className="text-xs text-slate-700 dark:text-slate-300">
                      {merchant}
                    </span>
                  ) : (
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-red-500">Missing</span>
                        {canEditMid ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMid(c.id);
                              setSelectedMid("");
                            }}
                            className="text-xs text-[#8DE3B5] underline hover:opacity-80"
                          >
                            Add
                          </button>
                        ) : null}
                      </div>
                      {canEditMid && editingMid === c.id ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <select
                            value={selectedMid}
                            onChange={(e) => setSelectedMid(e.target.value)}
                            className="crm-input max-w-[140px] py-0.5 text-xs"
                          >
                            <option value="">Select MID…</option>
                            {midOptions.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!selectedMid}
                            onClick={() => {
                              void onSaveMid?.(c.id, selectedMid).then(() => {
                                setEditingMid(null);
                                setSelectedMid("");
                              });
                            }}
                            className="rounded bg-[#8DE3B5] px-2 py-0.5 text-xs text-[#0A2540] disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMid(null);
                              setSelectedMid("");
                            }}
                            className="text-xs text-slate-400 underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">
                  {hasAddressIssue ? (
                    <div>
                      <p className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                        {warning}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {c.street_address?.trim() || "—"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {formatAddress(c)}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">
                  {c.phone_mobile?.trim() || "—"}
                </td>
                <td className="py-3 pr-3 text-slate-600 dark:text-slate-400">
                  {formatDateQueued(c)}
                </td>
                {canManualSend ? (
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      disabled={
                        isSending ||
                        hasAddressIssue ||
                        !hasMid ||
                        !onManualSend
                      }
                      onClick={() =>
                        void onManualSend?.(
                          c.id,
                          isSecondary ? "secondary" : "primary"
                        )
                      }
                      title={
                        hasAddressIssue
                          ? "Fix address before sending"
                          : !hasMid
                            ? "Set MID before sending"
                            : "Send this recipient to PostLogic + PDF generator"
                      }
                      className="rounded border border-amber-400/60 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-600/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                    >
                      {isSending ? "Sending…" : "Send to PostLogic"}
                    </button>
                  </td>
                ) : null}
              </tr>
            );
            })
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
