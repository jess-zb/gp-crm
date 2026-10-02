import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PacketNeededRow,
  PacketShipmentRow,
} from "@/app/admin/fedex-batches/packet-manager-types";
import { comparePacketsNeededOrder } from "@/lib/packets/shipment-sort";
import { FEDEX_BATCH_EXCLUDED_STAGE_SET } from "@/lib/postlogic/fedex-ready-filter";
import { hasSecondaryPacketLastName } from "@/lib/postlogic/send-fedex-recipients";
import { partitionPacketManagerTabs } from "@/lib/packets/packet-manager-tabs";
import { isUndefinedColumnError } from "@/lib/packets/carrier-status-column";
import { isCarrierScanStatus } from "@/lib/postlogic/shipment-status-sync";

const SHIPMENT_SELECT_CORE =
  "id, tracking_number, recipient_name, recipient_type, carrier, batch_id, batch_date, status, advisor, merchant, street_address, city, state, zip_code, phone, sent_at, delivered_at, client_id, client:clients!client_id(id, first_name, last_name, phone_mobile, stage, created_at, fedex_queued_at)";

const SHIPMENT_SELECT =
  "id, tracking_number, recipient_name, recipient_type, carrier, batch_id, batch_date, status, carrier_status, advisor, merchant, street_address, city, state, zip_code, phone, sent_at, delivered_at, client_id, client:clients!client_id(id, first_name, last_name, phone_mobile, stage, created_at, fedex_queued_at)";

const NEEDED_CLIENT_SELECT = `
  id,
  first_name,
  last_name,
  phone_mobile,
  street_address,
  city,
  state,
  zip_code,
  spouse_first_name,
  spouse_last_name,
  fedex_queued_at,
  fedex_merchant,
  stage,
  created_at,
  assigned_user:profiles!assigned_to (
    full_name
  )
`;

const PAGE_SIZE = 1000;

/** Service-role fetch — bypasses RLS; only call from protected server routes. */
export async function fetchPacketManagerData(): Promise<{
  packetsSent: PacketShipmentRow[];
  packetsDelivered: PacketShipmentRow[];
  archiveShipments: PacketShipmentRow[];
  latestBatch: string | null;
  secondBatch: string | null;
}> {
  const supabase = createAdminClient();

  let allShipments: PacketShipmentRow[] = [];
  let from = 0;
  let shipmentSelect = SHIPMENT_SELECT;
  let includeCarrierStatus = true;

  while (true) {
    const { data, error } = await supabase
      .from("client_fedex_shipments")
      .select(shipmentSelect)
      .neq("status", "Pending")
      .order("batch_date", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error && includeCarrierStatus && isUndefinedColumnError(error, "carrier_status")) {
      console.warn(
        "[PacketManager] carrier_status column missing; loading without it"
      );
      includeCarrierStatus = false;
      shipmentSelect = SHIPMENT_SELECT_CORE;
      allShipments = [];
      from = 0;
      continue;
    }

    if (error) {
      console.error(
        "[PacketManager] fetch error:",
        error.message,
        error.code
      );
      break;
    }

    if (!data?.length) break;

    const chunk = data.map((row) => {
      const status = (row as { status?: string | null }).status ?? null;
      const carrier =
        includeCarrierStatus
          ? ((row as { carrier_status?: string | null }).carrier_status ?? null)
          : isCarrierScanStatus(status)
            ? status
            : null;
      return {
        ...(row as object),
        carrier_status: carrier,
        client: null,
      };
    }) as PacketShipmentRow[];

    allShipments = [...allShipments, ...chunk];
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log("[PacketManager] total fetched:", allShipments.length);
  console.log("[PacketManager] shipments fetch:", {
    count: allShipments.length,
    firstRecord: allShipments[0] ?? null,
    batchIds: Array.from(
      new Set(
        allShipments.map((s) => s.batch_id).filter((id): id is string => !!id)
      )
    ).slice(0, 5),
  });

  const {
    packetsSent,
    packetsDelivered,
    archiveShipments: unsortedArchive,
    latestBatch,
    secondBatch,
  } = partitionPacketManagerTabs(allShipments);

  const archiveShipments = [...unsortedArchive].sort((a, b) => {
    const av = new Date(a.batch_date ?? a.sent_at ?? 0).getTime();
    const bv = new Date(b.batch_date ?? b.sent_at ?? 0).getTime();
    return bv - av;
  });

  console.log("[PacketManager] tabs:", {
    latestBatch,
    secondBatch,
    sent: packetsSent.length,
    delivered: packetsDelivered.length,
    archive: archiveShipments.length,
  });

  return {
    packetsSent,
    packetsDelivered,
    archiveShipments,
    latestBatch,
    secondBatch,
  };
}

async function loadClientIdSet(
  supabase: ReturnType<typeof createAdminClient>,
  table: "client_fedex_shipments" | "audit_log",
  column: "client_id",
  filter?: { column: string; value: string },
  excludeStatus?: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;

  while (true) {
    let q = supabase.from(table).select(column).range(from, from + PAGE_SIZE - 1);
    if (filter) {
      q = q.eq(filter.column, filter.value);
    }
    if (excludeStatus) {
      q = q.neq("status", excludeStatus);
    }
    const { data, error } = await q;
    if (error) {
      console.warn(`[PacketManager] loadClientIdSet ${table}:`, error.message);
      break;
    }
    if (!data?.length) break;
    for (const row of data) {
      const id = (row as Record<string, string | null>)[column];
      if (id) ids.add(id);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return ids;
}

async function loadCardMerchantsForClients(
  supabase: ReturnType<typeof createAdminClient>,
  clientIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!clientIds.length) return result;

  const countsByClient = new Map<string, Map<string, number>>();

  for (let i = 0; i < clientIds.length; i += PAGE_SIZE) {
    const chunk = clientIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await supabase
      .from("client_cards")
      .select("client_id, merchant_name")
      .in("client_id", chunk)
      .not("merchant_name", "is", null);

    if (error) {
      console.warn("[PacketManager] loadCardMerchants:", error.message);
      break;
    }

    for (const row of data ?? []) {
      const cid = row.client_id as string;
      const m = (row.merchant_name as string | null)?.trim();
      if (!m) continue;
      if (!countsByClient.has(cid)) countsByClient.set(cid, new Map());
      const g = countsByClient.get(cid)!;
      g.set(m, (g.get(m) ?? 0) + 1);
    }
  }

  Array.from(countsByClient.entries()).forEach(([cid, counts]) => {
    let best = "";
    let bestN = 0;
    Array.from(counts.entries()).forEach(([m, n]) => {
      if (n > bestN) {
        best = m;
        bestN = n;
      }
    });
    if (best) result.set(cid, best);
  });

  return result;
}

function attachCardMerchants(
  rows: PacketNeededRow[],
  cardMerchants: Map<string, string>
): PacketNeededRow[] {
  return rows.map((row) => ({
    ...row,
    card_merchant: cardMerchants.get(row.id) ?? null,
  }));
}

const DATA_CUTOFF = "2026-06-02";

type ClientStageRow = Omit<PacketNeededRow, "recipient_type">;

async function loadStageClientRows(
  supabase: ReturnType<typeof createAdminClient>,
  stage: string
): Promise<{ rows: ClientStageRow[]; error: string | null }> {
  let rows: ClientStageRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("clients")
      .select(NEEDED_CLIENT_SELECT)
      .eq("stage", stage)
      .eq("is_active", true)
      .gte("created_at", DATA_CUTOFF)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`[PacketManager] ${stage} query:`, error.message);
      return { rows: [], error: error.message };
    }
    if (!data?.length) break;
    rows = [...rows, ...(data as ClientStageRow[])];
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { rows, error: null };
}

/** All client IDs with a Pending resend marker (paginated to completion). */
async function loadPendingResendClientIds(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("client_fedex_shipments")
      .select("client_id")
      .eq("status", "Pending")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.warn("[PacketManager] loadPendingResendClientIds:", error.message);
      break;
    }
    if (!data?.length) break;
    for (const row of data) {
      const id = row.client_id as string | null;
      if (id) ids.add(id);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return ids;
}

/** Active clients by id (no stage/cutoff filter — used for explicit Pending resends). */
async function loadClientRowsByIds(
  supabase: ReturnType<typeof createAdminClient>,
  clientIds: string[]
): Promise<{ rows: ClientStageRow[]; error: string | null }> {
  const rows: ClientStageRow[] = [];
  if (!clientIds.length) return { rows, error: null };

  for (let i = 0; i < clientIds.length; i += PAGE_SIZE) {
    const chunk = clientIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await supabase
      .from("clients")
      .select(NEEDED_CLIENT_SELECT)
      .in("id", chunk)
      .eq("is_active", true);
    if (error) {
      console.error("[PacketManager] loadClientRowsByIds:", error.message);
      return { rows: [], error: error.message };
    }
    rows.push(...((data as ClientStageRow[]) ?? []));
  }

  return { rows, error: null };
}

/**
 * Loads the per-client-id sets of recipient types that already have shipment rows
 * (split out by recipient_type so a primary shipment doesn't suppress a secondary).
 */
async function loadShipmentRecipientSets(
  supabase: ReturnType<typeof createAdminClient>
): Promise<{
  primaryShipped: Set<string>;
  secondaryShipped: Set<string>;
}> {
  const primaryShipped = new Set<string>();
  const secondaryShipped = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("client_fedex_shipments")
      .select("client_id, recipient_type, status")
      .neq("status", "Pending")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.warn("[PacketManager] loadShipmentRecipientSets:", error.message);
      break;
    }
    if (!data?.length) break;
    for (const row of data) {
      const clientId = row.client_id as string | null;
      const type = row.recipient_type as string | null;
      if (!clientId) continue;
      if (type === "secondary") secondaryShipped.add(clientId);
      else primaryShipped.add(clientId);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { primaryShipped, secondaryShipped };
}

/**
 * Packets Needed =
 *   A) Active client_services clients with no primary shipment and no fedex_declined
 *      (created on/after June 2 2026), plus
 *   B) Active clients with a Pending "Resend via FedEx" marker — any non-terminal
 *      stage; Pending also overrides a prior fedex_declined and primary-shipped
 *      exclusion so history is preserved while they re-enter the queue.
 *
 * Emits one row per recipient: every eligible client produces a primary row
 * (unless already shipped), and clients with spouse name set produce a separate
 * secondary row (unless already shipped or declined). Spouse last name is required
 * for a secondary row; first name alone is not enough.
 */
export async function fetchPacketsNeeded(): Promise<{
  rows: PacketNeededRow[];
  error: string | null;
}> {
  const supabase = createAdminClient();

  const [
    clientServicesResult,
    { primaryShipped, secondaryShipped },
    declinedClientIds,
    secondaryDeclinedIds,
    resendQueuedIds,
  ] = await Promise.all([
    loadStageClientRows(supabase, "client_services"),
    loadShipmentRecipientSets(supabase),
    loadClientIdSet(supabase, "audit_log", "client_id", {
      column: "action",
      value: "fedex_declined",
    }),
    loadClientIdSet(supabase, "audit_log", "client_id", {
      column: "action",
      value: "fedex_secondary_declined",
    }),
    loadPendingResendClientIds(supabase),
  ]);

  if (clientServicesResult.error) return { rows: [], error: clientServicesResult.error };

  const poolById = new Map<string, ClientStageRow>();
  for (const client of clientServicesResult.rows) {
    if (client.id) poolById.set(client.id, client);
  }

  // Pull active Pending-resend clients that are outside the client_services pool
  // (e.g. awaiting_collection_letter) so Resend via FedEx actually re-queues them.
  const missingPendingIds = Array.from(resendQueuedIds).filter((id) => !poolById.has(id));
  if (missingPendingIds.length) {
    const { rows: pendingClients, error: pendingErr } = await loadClientRowsByIds(
      supabase,
      missingPendingIds
    );
    if (pendingErr) return { rows: [], error: pendingErr };
    for (const client of pendingClients) {
      if (!client.id) continue;
      if (FEDEX_BATCH_EXCLUDED_STAGE_SET.has(client.stage ?? "")) continue;
      poolById.set(client.id, client);
    }
  }

  const seenPrimaryIds = new Set<string>();
  const seenSecondaryIds = new Set<string>();
  const rows: PacketNeededRow[] = [];

  for (const client of Array.from(poolById.values())) {
    if (!client.id) continue;
    if (FEDEX_BATCH_EXCLUDED_STAGE_SET.has(client.stage ?? "")) continue;
    // Explicit Resend (Pending marker) overrides a prior fedex_declined.
    if (declinedClientIds.has(client.id) && !resendQueuedIds.has(client.id)) continue;

    const primaryAlreadyShipped =
      primaryShipped.has(client.id) && !resendQueuedIds.has(client.id);

    if (!primaryAlreadyShipped && !seenPrimaryIds.has(client.id)) {
      seenPrimaryIds.add(client.id);
      rows.push({ ...client, recipient_type: "primary" });
    }

    if (
      hasSecondaryPacketLastName(client) &&
      !secondaryShipped.has(client.id) &&
      !secondaryDeclinedIds.has(client.id) &&
      !seenSecondaryIds.has(client.id)
    ) {
      seenSecondaryIds.add(client.id);
      rows.push({ ...client, recipient_type: "secondary" });
    }
  }

  rows.sort(comparePacketsNeededOrder);

  const cardMerchants = await loadCardMerchantsForClients(
    supabase,
    Array.from(new Set(rows.map((r) => r.id)))
  );

  return { rows: attachCardMerchants(rows, cardMerchants), error: null };
}
