import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchPostlogicBatch,
  fetchPostlogicShipmentByUniqueId,
} from "@/lib/postlogic/fetch-batch";
import { shipmentPatchFromCarrierScan } from "@/lib/postlogic/shipment-status-sync";
import {
  isUndefinedColumnError,
  omitCarrierStatus,
  retryWriteWithoutCarrierStatus,
} from "@/lib/packets/carrier-status-column";

export type SyncBatchIdsResult = {
  synced: number;
  total: number;
  message: string;
  error?: string;
};

/** Pull PostLogic tracking + unique IDs for one batch into client_fedex_shipments / clients. */
export async function runSyncIdsForBatch(
  batchId: string
): Promise<SyncBatchIdsResult> {
  const admin = createAdminClient();

  const plResult = await fetchPostlogicBatch(batchId);
  console.log("[SyncIDs] status:", plResult.status);
  console.log("[SyncIDs] response:", plResult.raw.substring(0, 500));

  if (!plResult.ok) {
    return {
      synced: 0,
      total: 0,
      message: `PostLogic error: ${plResult.status}`,
    };
  }

  const plShipments = plResult.shipments;

  let { data, error: fetchErr } = await admin
    .from("client_fedex_shipments")
    .select("id, recipient_name, phone, tracking_number, status, carrier_status, client_id")
    .eq("batch_id", batchId);

  if (fetchErr && isUndefinedColumnError(fetchErr, "carrier_status")) {
    const fallback = await admin
      .from("client_fedex_shipments")
      .select("id, recipient_name, phone, tracking_number, status, client_id")
      .eq("batch_id", batchId);
    data = fallback.data as typeof data;
    fetchErr = fallback.error;
  }

  const ourShipments = data as {
    id: string;
    recipient_name: string | null;
    phone: string | null;
    tracking_number: string | null;
    status: string | null;
    carrier_status: string | null;
    client_id: string | null;
  }[] | null;

  if (fetchErr) {
    return {
      synced: 0,
      total: 0,
      message: fetchErr.message,
      error: fetchErr.message,
    };
  }

  // Carrier progress only. Never copy In Transit onto Delivered/Archived —
  // those are Packet Manager tab positions, not live FedEx state.
  let synced = 0;

  for (const pl of plShipments) {
    const match = ourShipments?.find((s) => {
      const plName = pl.recipient?.toLowerCase().trim();
      const ourName = s.recipient_name?.toLowerCase().trim();
      return (
        (plName && ourName && plName === ourName) ||
        (!!pl.phone && pl.phone === s.phone)
      );
    });

    if (!match) continue;

    const updates: {
      tracking_number?: string;
      carrier_status?: string;
      status?: string;
      delivered_at?: string;
    } = {};

    if (pl.tracking && !match.tracking_number) {
      updates.tracking_number = pl.tracking;
    }

    const scanPatch = shipmentPatchFromCarrierScan({
      tabStatus: match.status,
      carrierStatus: match.carrier_status,
      incoming: pl.status,
    });
    if (scanPatch) {
      updates.carrier_status = scanPatch.carrier_status;
      if (scanPatch.status === "Delivered") {
        updates.status = "Delivered";
        updates.delivered_at = new Date().toISOString();
      }
    }

    if (pl.unique_id && match.client_id) {
      await admin
        .from("clients")
        .update({ postlogic_unique_id: pl.unique_id })
        .eq("id", match.client_id)
        .is("postlogic_unique_id", null);
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await retryWriteWithoutCarrierStatus(
        () =>
          admin.from("client_fedex_shipments").update(updates).eq("id", match.id),
        () =>
          admin
            .from("client_fedex_shipments")
            .update(omitCarrierStatus(updates))
            .eq("id", match.id)
      );
      if (!upErr) synced++;
    }
  }

  // Batch list may miss archived rows — re-check In Transit via unique_id lookup.
  let { data: inTransitRows, error: inTransitErr } = await admin
    .from("client_fedex_shipments")
    .select(
      "id, tracking_number, status, carrier_status, clients!inner(postlogic_unique_id)"
    )
    .eq("batch_id", batchId)
    .in("status", ["Processing", "Delivered"]);

  if (inTransitErr && isUndefinedColumnError(inTransitErr, "carrier_status")) {
    const fallback = await admin
      .from("client_fedex_shipments")
      .select("id, tracking_number, status, clients!inner(postlogic_unique_id)")
      .eq("batch_id", batchId)
      .in("status", ["Processing", "Delivered"]);
    inTransitRows = fallback.data as typeof inTransitRows;
    inTransitErr = fallback.error;
  }

  if (inTransitErr) {
    console.warn("[SyncIDs] in-transit lookup:", inTransitErr.message);
  } else {
    const rows = inTransitRows as ({
      id: string;
      tracking_number: string | null;
      status: string | null;
      carrier_status: string | null;
      clients: { postlogic_unique_id: string | null } | { postlogic_unique_id: string | null }[] | null;
    })[] | null;

    for (const row of rows ?? []) {
      const clientRaw = row.clients;
    const client = Array.isArray(clientRaw) ? clientRaw[0] : (clientRaw as { postlogic_unique_id: string | null } | null);
      const uniqueId = client?.postlogic_unique_id?.trim();
      if (!uniqueId) continue;

      try {
        const plSingle = await fetchPostlogicShipmentByUniqueId(uniqueId);
        if (!plSingle.ok || !plSingle.shipment) continue;

        const shipment = plSingle.shipment;
        const scanPatch = shipmentPatchFromCarrierScan({
          tabStatus: row.status,
          carrierStatus: row.carrier_status,
          incoming: shipment.status?.trim(),
        });
        if (!scanPatch && !shipment.tracking?.trim()) continue;

        const updates: {
          carrier_status?: string;
          status?: string;
          tracking_number?: string;
          delivered_at?: string;
        } = {};
        if (scanPatch) {
          updates.carrier_status = scanPatch.carrier_status;
          if (scanPatch.status === "Delivered") {
            updates.status = "Delivered";
            updates.delivered_at = new Date().toISOString();
          }
        }

        const tracking = shipment.tracking?.trim();
        if (tracking) {
          updates.tracking_number = tracking;
        }

        if (Object.keys(updates).length === 0) continue;

        const { error: upErr } = await retryWriteWithoutCarrierStatus(
          () =>
            admin.from("client_fedex_shipments").update(updates).eq("id", row.id),
          () =>
            admin
              .from("client_fedex_shipments")
              .update(omitCarrierStatus(updates))
              .eq("id", row.id)
        );

        if (!upErr) {
          synced++;
          console.log("[SyncIDs] archive update:", row.id, uniqueId, shipment.status);
        }
      } catch (err) {
        console.warn("[SyncIDs] archive check failed:", row.id, err);
      }
    }
  }

  return {
    synced,
    total: plShipments.length,
    message:
      synced > 0
        ? `Synced ${synced} of ${plShipments.length} shipments from PostLogic`
        : `PostLogic returned ${plShipments.length} records — all up to date`,
  };
}
