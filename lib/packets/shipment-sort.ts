import type { PacketNeededRow, PacketShipmentRow } from "@/app/admin/fedex-batches/packet-manager-types";

export type ShipmentSortField =
  | "recipient_name"
  | "batch_date"
  | "status"
  | "advisor"
  | "carrier";

export type SortDir = "asc" | "desc";

export type NeededSortField =
  | "recipient_name"
  | "phone"
  | "zip_code"
  | "batch_date"
  | "advisor";

function dateMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Packets Needed "Date Created" sort key — matches the UI column
 * (`fedex_queued_at` when set, otherwise `created_at`). Empty strings
 * fall through so they don't produce NaN and scramble sort order.
 */
export function packetsNeededDateMs(row: {
  fedex_queued_at?: string | null;
  created_at?: string | null;
}): number {
  const queued = row.fedex_queued_at?.trim();
  const created = row.created_at?.trim();
  return dateMs(queued || created || null);
}

type PacketsNeededOrderRow = {
  id: string;
  fedex_queued_at?: string | null;
  created_at?: string | null;
  recipient_type?: "primary" | "secondary" | string | null;
};

/**
 * Canonical Packets Needed order: Date Created ASC, then client id,
 * then primary before secondary. Used by the UI, fetchPacketsNeeded,
 * and the PostLogic/PDF batch sender so all three stay aligned.
 */
export function comparePacketsNeededOrder(
  a: PacketsNeededOrderRow,
  b: PacketsNeededOrderRow
): number {
  const at = packetsNeededDateMs(a);
  const bt = packetsNeededDateMs(b);
  if (at !== bt) return at - bt;
  if (a.id !== b.id) return a.id.localeCompare(b.id);
  const aSec = a.recipient_type === "secondary" ? 1 : 0;
  const bSec = b.recipient_type === "secondary" ? 1 : 0;
  return aSec - bSec;
}

export function sortShipments(
  rows: PacketShipmentRow[],
  sortField: ShipmentSortField,
  sortDir: SortDir
): PacketShipmentRow[] {
  const mult = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortField === "batch_date") {
      const av = dateMs(a.batch_date ?? a.sent_at);
      const bv = dateMs(b.batch_date ?? b.sent_at);
      if (av !== bv) return mult * (av - bv);
      // Within the same batch, preserve Packets Needed Date Created order.
      const ca = Array.isArray(a.client) ? a.client[0] : a.client;
      const cb = Array.isArray(b.client) ? b.client[0] : b.client;
      return (
        packetsNeededDateMs({
          fedex_queued_at: ca?.fedex_queued_at,
          created_at: ca?.created_at,
        }) -
        packetsNeededDateMs({
          fedex_queued_at: cb?.fedex_queued_at,
          created_at: cb?.created_at,
        })
      );
    }
    const av = String(a[sortField] ?? "").trim().toLowerCase();
    const bv = String(b[sortField] ?? "").trim().toLowerCase();
    return mult * av.localeCompare(bv);
  });
}

export function sortNeededClients(
  rows: PacketNeededRow[],
  sortField: NeededSortField,
  sortDir: SortDir
): PacketNeededRow[] {
  const mult = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortField === "batch_date") {
      const at = packetsNeededDateMs(a);
      const bt = packetsNeededDateMs(b);
      if (at !== bt) return mult * (at - bt);
      // Tiebreakers stay stable regardless of sort direction.
      if (a.id !== b.id) return a.id.localeCompare(b.id);
      const aSec = a.recipient_type === "secondary" ? 1 : 0;
      const bSec = b.recipient_type === "secondary" ? 1 : 0;
      return aSec - bSec;
    }
    if (sortField === "recipient_name") {
      const aName =
        a.recipient_type === "secondary"
          ? `${a.spouse_first_name ?? ""} ${a.spouse_last_name ?? ""}`
          : `${a.first_name ?? ""} ${a.last_name ?? ""}`;
      const bName =
        b.recipient_type === "secondary"
          ? `${b.spouse_first_name ?? ""} ${b.spouse_last_name ?? ""}`
          : `${b.first_name ?? ""} ${b.last_name ?? ""}`;
      const av = aName.trim().toLowerCase();
      const bv = bName.trim().toLowerCase();
      return mult * av.localeCompare(bv);
    }
    if (sortField === "advisor") {
      const rawA = a.assigned_user;
      const rawB = b.assigned_user;
      const uA = Array.isArray(rawA) ? rawA[0] : rawA;
      const uB = Array.isArray(rawB) ? rawB[0] : rawB;
      const av = (uA?.full_name ?? "").trim().toLowerCase();
      const bv = (uB?.full_name ?? "").trim().toLowerCase();
      return mult * av.localeCompare(bv);
    }
    const av = String(a[sortField === "phone" ? "phone_mobile" : "zip_code"] ?? "")
      .trim()
      .toLowerCase();
    const bv = String(b[sortField === "phone" ? "phone_mobile" : "zip_code"] ?? "")
      .trim()
      .toLowerCase();
    return mult * av.localeCompare(bv);
  });
}

/** Newest batch ids first (uses max batch_date per id, then batch_id parse). */
export function sortBatchIdsNewestFirst(
  batchIds: string[],
  shipments: PacketShipmentRow[]
): string[] {
  const key = (batchId: string) => {
    let max = 0;
    for (const s of shipments) {
      if (s.batch_id !== batchId) continue;
      const t = dateMs(s.batch_date ?? s.sent_at);
      if (t > max) max = t;
    }
    if (max) return max;
    const t = new Date(batchId).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  return [...batchIds].sort((a, b) => key(b) - key(a));
}
