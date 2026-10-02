"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";

type ShipmentRow = {
  id: string;
  tracking_number: string | null;
  carrier: string | null;
  batch_id: string | null;
  batch_date: string | null;
  status: string | null;
  merchant: string | null;
  sent_at: string | null;
  delivered_at: string | null;
};

function statusBadge(status: string | null) {
  const s = status?.trim() ?? "";
  let cls = "rounded-full px-2 py-0.5 text-[11px] font-semibold ";
  if (s === "Delivered") {
    cls += "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  } else if (s === "Out for Delivery") {
    cls += "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  } else if (s === "Exception" || s === "Failed") {
    cls += "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  } else if (s === "Processing" || s === "Sent") {
    cls += "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  } else {
    cls += "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }
  return <span className={cls}>{s || "—"}</span>;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function batchLabel(row: ShipmentRow): string {
  const date = row.batch_date ?? row.batch_id;
  if (!date) return "—";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PacketsHistoryTab({
  clientId,
  shipments,
}: {
  clientId: string;
  shipments: ShipmentRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    setLoading(true);
    try {
      const r = await fetch("/api/packets/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Failed to resend");
      toast.success("Re-queued for next FedEx batch");
      setConfirming(false);
      router.refresh();
    } catch (e) {
      toast.error(toUserFacingError(e instanceof Error ? e.message : "Failed to resend"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-[#E8EAEE]">
          Packet History
          {shipments.length > 0 ? (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-[#102840] dark:text-slate-400">
              {shipments.length}
            </span>
          ) : null}
        </h3>
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Re-queues for the next batch. Existing history is preserved.
            </span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={loading}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1a3550] dark:text-slate-300 dark:hover:bg-[#102840]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={loading}
              className="rounded-md bg-[#8DE3B5] px-3 py-1.5 text-xs font-semibold text-[#0A2540] hover:bg-[#6BC99A] disabled:opacity-50"
            >
              {loading ? "Re-queuing…" : "Confirm Resend"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-md border border-[#8DE3B5]/50 bg-[#8DE3B5]/10 px-3 py-1.5 text-xs font-semibold text-[#8DE3B5] transition hover:bg-[#8DE3B5]/20"
          >
            Resend via FedEx
          </button>
        )}
      </div>

      {shipments.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No packets have been sent for this client yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1a3550]">
                {["Status", "Batch", "Merchant", "Tracking #", "Carrier", "Sent", "Delivered"].map(
                  (h) => (
                    <th
                      key={h}
                      className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 last:border-0 dark:border-[#1e3820]"
                >
                  <td className="py-3 pr-4">{statusBadge(s.status)}</td>
                  <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                    {batchLabel(s)}
                  </td>
                  <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                    {s.merchant?.trim() || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {s.tracking_number?.trim() || "—"}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                    {s.carrier?.trim() || "—"}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                    {fmt(s.sent_at)}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                    {fmt(s.delivered_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
