"use client";

import type { ShipmentSortField, SortDir } from "@/lib/packets/shipment-sort";

export function SortableHeader({
  field,
  label,
  current,
  dir,
  onSort,
  className = "",
}: {
  field: ShipmentSortField;
  label: string;
  current: ShipmentSortField;
  dir: SortDir;
  onSort: (field: ShipmentSortField) => void;
  className?: string;
}) {
  const active = field === current;
  return (
    <th
      className={`crm-table-header cursor-pointer select-none pb-2 pr-3 font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#102840] ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="text-xs text-slate-400">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </div>
    </th>
  );
}
