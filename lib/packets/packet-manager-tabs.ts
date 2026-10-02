/**
 * Packet Manager tabs from workflow `status` only.
 * Live FedEx/PostLogic scan lives on carrier_status and must not choose the tab.
 */

export const PACKET_TAB_PROCESSING = "Processing";
export const PACKET_TAB_DELIVERED = "Delivered";
export const PACKET_TAB_ARCHIVED = "Archived";

export type PacketTabShipment = {
  batch_id: string | null;
  status: string | null;
};

function uniqueBatchIdsDesc(rows: PacketTabShipment[]): string[] {
  return Array.from(
    new Set(rows.map((s) => s.batch_id?.trim()).filter((id): id is string => !!id))
  ).sort((a, b) => b.localeCompare(a));
}

export function partitionPacketManagerTabs<T extends PacketTabShipment>(
  allShipments: T[]
): {
  packetsSent: T[];
  packetsDelivered: T[];
  archiveShipments: T[];
  latestBatch: string | null;
  secondBatch: string | null;
} {
  const packetsSent = allShipments.filter(
    (s) => (s.status ?? "") === PACKET_TAB_PROCESSING
  );
  const packetsDelivered = allShipments.filter(
    (s) => (s.status ?? "") === PACKET_TAB_DELIVERED
  );
  const archiveShipments = allShipments.filter(
    (s) => (s.status ?? "") !== PACKET_TAB_PROCESSING && (s.status ?? "") !== PACKET_TAB_DELIVERED
  );

  const latestBatch = uniqueBatchIdsDesc(packetsSent)[0] ?? null;
  const secondBatch = uniqueBatchIdsDesc(packetsDelivered)[0] ?? null;

  return {
    packetsSent,
    packetsDelivered,
    archiveShipments,
    latestBatch,
    secondBatch,
  };
}
