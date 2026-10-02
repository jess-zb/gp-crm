import type { PacketShipmentRow } from "@/app/admin/fedex-batches/packet-manager-types";

export function shipmentSearchFilter(
  shipment: PacketShipmentRow,
  query: string
): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();

  const client = normalizeClientEmbed(shipment.client);

  const fields = [
    shipment.recipient_name,
    shipment.tracking_number,
    shipment.phone,
    shipment.city,
    shipment.zip_code,
    shipment.advisor,
    shipment.merchant,
    shipment.batch_id,
    client?.first_name,
    client?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return q.split(/\s+/).every((word) => fields.includes(word));
}

function normalizeClientEmbed(
  raw: PacketShipmentRow["client"]
): { first_name: string | null; last_name: string | null } | null {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  return row ?? null;
}
