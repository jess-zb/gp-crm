"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CarrierBadge } from "./CarrierBadge";
import type { PacketShipmentRow } from "./packet-manager-types";

interface BatchGroup {
  batchId: string;
  batchDate: string;
  total: number;
  delivered: number;
  carriers: Record<string, number>;
}

function BatchCard({ group }: { group: BatchGroup }) {
  const pct =
    group.total > 0 ? Math.round((group.delivered / group.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-[#1a3550] dark:bg-[#071929]/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
          {new Date(`${group.batchDate}T12:00:00`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <div className="flex flex-wrap justify-end gap-1">
          {Object.keys(group.carriers).map((carrier) => (
            <CarrierBadge key={carrier} carrier={carrier} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <p className="text-lg font-bold leading-none text-slate-800 dark:text-slate-100">
            {group.total}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Total</p>
        </div>
        <div>
          <p className="text-lg font-bold leading-none text-green-600 dark:text-green-400">
            {group.delivered}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Delivered</p>
        </div>
      </div>

      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-0.5 text-right text-[10px] text-slate-400">{pct}% delivered</p>
      </div>
    </div>
  );
}

export function BatchSummarySection({
  archiveShipments,
}: {
  archiveShipments: PacketShipmentRow[];
}) {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    const groups = archiveShipments.reduce<Record<string, BatchGroup>>((acc, s) => {
      const key = s.batch_id || "unknown";
      if (!acc[key]) {
        acc[key] = {
          batchId: key,
          batchDate: s.batch_date || key,
          total: 0,
          delivered: 0,
          carriers: {},
        };
      }
      const g = acc[key];
      g.total++;
      const st = s.status?.toLowerCase() || "";
      if (st === "delivered" || st === "archived") g.delivered++;
      const carrier = (s.carrier?.trim() || "other").toLowerCase();
      g.carriers[carrier] = (g.carriers[carrier] || 0) + 1;
      return acc;
    }, {});

    return Object.values(groups).sort(
      (a, b) =>
        new Date(b.batchDate).getTime() - new Date(a.batchDate).getTime()
    );
  }, [archiveShipments]);

  const visibleBatches = expanded ? sorted : sorted.slice(0, 3);

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Batch Summary
        </h3>
        <span className="text-[10px] text-slate-400">
          {sorted.length} batches ·{expanded ? " showing all" : " showing latest 3"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visibleBatches.map((g) => (
          <BatchCard key={g.batchId} group={g} />
        ))}
      </div>

      {sorted.length > 3 ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mx-auto mt-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? "Show less" : `Show ${sorted.length - 3} more batches`}
        </button>
      ) : null}
    </div>
  );
}
