/**
 * status = Packet Manager tab (Pending / Processing / Delivered / Archived).
 * carrier_status = printer/FedEx scan. Poll must never copy a scan onto `status`
 * except Processing → Delivered when FedEx actually delivered.
 */

export const PACKET_TAB_STATUSES = [
  "Pending",
  "Processing",
  "Delivered",
  "Archived",
] as const;

export type PacketTabStatus = (typeof PACKET_TAB_STATUSES)[number];

const CARRIER_SCANS = new Set([
  "Processing",
  "Production",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Returned",
  "Label Created",
  "Sent",
]);

export function isCarrierScanStatus(
  status: string | null | undefined
): boolean {
  return CARRIER_SCANS.has((status ?? "").trim());
}

export function shipmentPatchFromCarrierScan(opts: {
  tabStatus: string | null | undefined;
  carrierStatus: string | null | undefined;
  incoming: string | null | undefined;
}): { carrier_status: string; status?: "Delivered" } | null {
  const tab = (opts.tabStatus ?? "").trim();
  const currentCarrier = (opts.carrierStatus ?? "").trim();
  const incoming = (opts.incoming ?? "").trim();
  if (!incoming || !isCarrierScanStatus(incoming)) return null;

  const promoteTab =
    incoming === "Delivered" && tab === "Processing";

  if (!promoteTab && incoming === currentCarrier) return null;

  const patch: { carrier_status: string; status?: "Delivered" } = {
    carrier_status: incoming,
  };
  if (promoteTab) patch.status = "Delivered";
  return patch;
}
