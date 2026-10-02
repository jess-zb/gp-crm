"use client";

import Link from "next/link";
import { CarrierBadge, getShipmentTrackingUrl } from "./CarrierBadge";
import { SortableHeader } from "./SortableHeader";
import type { PacketShipmentRow, ShipmentClientEmbed } from "./packet-manager-types";
import type { ShipmentSortField, SortDir } from "@/lib/packets/shipment-sort";
import {
  getStatusBadgeClass,
  mapPostlogicStatusToLabel,
} from "@/lib/postlogic/fedex-print-status";

function normalizeClient(
  raw: PacketShipmentRow["client"]
): ShipmentClientEmbed | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function formatShipmentAddress(s: PacketShipmentRow): string {
  const parts = [
    s.street_address?.trim(),
    [s.city, s.state].filter(Boolean).join(", "),
    s.zip_code?.trim(),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function formatBatchDateCell(batchDate: string | null | undefined): string {
  if (!batchDate) return "—";
  const d = new Date(`${batchDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ carrierStatus }: { carrierStatus: string | null }) {
  const label = mapPostlogicStatusToLabel(carrierStatus);
  const cls = getStatusBadgeClass(carrierStatus);
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function RecipientCell({ shipment }: { shipment: PacketShipmentRow }) {
  const client = normalizeClient(shipment.client);
  const rawClientId = client?.id ?? shipment.client_id;
  const clientId =
    typeof rawClientId === "string" &&
    rawClientId.trim() !== "" &&
    rawClientId !== "null"
      ? rawClientId
      : null;

  return (
    <td className="py-3 pr-3">
      <div className="flex items-center gap-2">
        {clientId ? (
          <Link
            href={`/clients/${clientId}`}
            className="text-sm font-medium text-[#8DE3B5] hover:underline dark:text-[#7fbf6f]"
          >
            {shipment.recipient_name}
          </Link>
        ) : (
          <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            {shipment.recipient_name}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              unlinked
            </span>
          </span>
        )}
        {shipment.recipient_type === "secondary" ? (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            Secondary
          </span>
        ) : null}
      </div>
    </td>
  );
}

function ShipmentRow({
  shipment,
  hiddenColumns,
  isDev,
  onMarkDelivered,
  onReturnToQueue,
  rowActionLoading,
}: {
  shipment: PacketShipmentRow;
  hiddenColumns?: string[];
  isDev?: boolean;
  onMarkDelivered?: (shipmentId: string) => void;
  onReturnToQueue?: (clientId: string) => void;
  rowActionLoading?: string | null;
}) {
  const hideDate = hiddenColumns?.includes("batch_date");
  const isDelivered =
    shipment.status === "Delivered" || shipment.status === "Archived";
  const isLoading =
    rowActionLoading === shipment.id || rowActionLoading === shipment.client_id;

  return (
    <tr className="border-b border-slate-100 dark:border-[#1a3550]">
      <RecipientCell shipment={shipment} />
      <td className="py-3 pr-3">
        <CarrierBadge carrier={shipment.carrier} />
      </td>
      <td className="py-3 pr-3">
        {shipment.tracking_number?.trim() ? (
          <a
            href={getShipmentTrackingUrl(
              shipment.tracking_number.trim(),
              shipment.carrier
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {shipment.tracking_number.trim()}
          </a>
        ) : (
          <span className="text-xs text-slate-400">Pending</span>
        )}
      </td>
      <td className="py-3 pr-3">
        <StatusBadge
          carrierStatus={shipment.carrier_status ?? shipment.status}
        />
      </td>
      <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">
        {shipment.advisor?.trim() || "—"}
      </td>
      <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">
        {shipment.merchant?.trim() || "—"}
      </td>
      <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">
        {formatShipmentAddress(shipment)}
      </td>
      {!hideDate ? (
        <td className="py-3 pr-3 text-slate-600 dark:text-slate-400">
          {formatBatchDateCell(shipment.batch_date)}
        </td>
      ) : null}
      {isDev ? (
        <td className="py-3 pr-3">
          <div className="flex items-center gap-1.5">
            {!isDelivered && onMarkDelivered ? (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onMarkDelivered(shipment.id)}
                className="rounded border border-green-300 bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50 dark:border-green-700/40 dark:bg-green-950/30 dark:text-green-300"
              >
                {isLoading ? "…" : "Mark Delivered"}
              </button>
            ) : null}
            {onReturnToQueue ? (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onReturnToQueue(shipment.client_id)}
                className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {isLoading ? "…" : "Return to Queue"}
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

export function ShipmentTable({
  shipments,
  emptyMessage,
  sortField,
  sortDir,
  onSort,
  hiddenColumns,
  isDev,
  onMarkDelivered,
  onReturnToQueue,
  rowActionLoading,
}: {
  shipments: PacketShipmentRow[];
  emptyMessage: string;
  sortField: ShipmentSortField;
  sortDir: SortDir;
  onSort: (field: ShipmentSortField) => void;
  hiddenColumns?: string[];
  isDev?: boolean;
  onMarkDelivered?: (shipmentId: string) => void;
  onReturnToQueue?: (clientId: string) => void;
  rowActionLoading?: string | null;
}) {
  const hideDate = hiddenColumns?.includes("batch_date");
  const colCount = (hideDate ? 7 : 8) + (isDev ? 1 : 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-[#1a3550]">
            <SortableHeader
              field="recipient_name"
              label="Recipient Name"
              current={sortField}
              dir={sortDir}
              onSort={onSort}
            />
            <SortableHeader
              field="carrier"
              label="Carrier"
              current={sortField}
              dir={sortDir}
              onSort={onSort}
            />
            <th className="pb-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">
              Tracking #
            </th>
            <SortableHeader
              field="status"
              label="Status"
              current={sortField}
              dir={sortDir}
              onSort={onSort}
            />
            <SortableHeader
              field="advisor"
              label="Advisor"
              current={sortField}
              dir={sortDir}
              onSort={onSort}
            />
            <th className="pb-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">
              Merchant
            </th>
            <th className="pb-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">
              Address
            </th>
            {!hideDate ? (
              <SortableHeader
                field="batch_date"
                label="Date"
                current={sortField}
                dir={sortDir}
                onSort={onSort}
              />
            ) : null}
            {isDev ? (
              <th className="pb-2 pr-3 font-semibold text-amber-600 dark:text-amber-400">
                Dev Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {shipments.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="py-8 text-center text-slate-500 dark:text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            shipments.map((s) => (
              <ShipmentRow
                key={s.id}
                shipment={s}
                hiddenColumns={hiddenColumns}
                isDev={isDev}
                onMarkDelivered={onMarkDelivered}
                onReturnToQueue={onReturnToQueue}
                rowActionLoading={rowActionLoading}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
