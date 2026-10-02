import type { SupabaseClient } from "@supabase/supabase-js";
import { getAddressWarning } from "@/lib/utils/address-validation";
import { comparePacketsNeededOrder } from "@/lib/packets/shipment-sort";
import { FEDEX_BATCH_EXCLUDED_STAGE_SET } from "@/lib/postlogic/fedex-ready-filter";
import { getTodayBatchId } from "./batch-helpers";
import {
  loadCardMerchantMap,
  resolveRecipientMerchant,
  sendFedexRecipients,
  hasSecondaryPacketLastName,
  type FedexSendClient,
  type FedexSendRecipient,
  type FedexSentRow,
} from "./send-fedex-recipients";

const DATA_CUTOFF = "2026-06-02";
const PAGE_SIZE = 1000;

const ELIGIBLE_CLIENT_SELECT =
  "id, first_name, last_name, spouse_first_name, spouse_last_name, phone_mobile, phone, street_address, city, state, zip_code, assigned_to, fedex_merchant, fedex_queued_at, created_at, stage";

type EligibleClient = FedexSendClient & {
  fedex_queued_at: string | null;
  created_at: string | null;
  stage?: string | null;
};

type EligibleRecipient = FedexSendRecipient;

export type PendingBatchSentRow = FedexSentRow;

/**
 * Fetch EVERY row a query would return, paging past the 1000-row window.
 * A single `.range(0, 999)` silently drops previously-shipped clients once a
 * table crosses 1000 rows — which for the exclusion sets means mailing a
 * duplicate physical packet. Always page these to completion.
 */
async function fetchAllRows<T>(
  makeQuery: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await makeQuery(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

async function loadEligibleClients(
  supabase: SupabaseClient,
  resendQueuedIds: Set<string>
): Promise<{ clients: EligibleClient[]; error: string | null }> {
  try {
    const byId = new Map<string, EligibleClient>();

    const clientServices = await fetchAllRows<EligibleClient>((from, to) =>
      supabase
        .from("clients")
        .select(ELIGIBLE_CLIENT_SELECT)
        .eq("stage", "client_services")
        .eq("is_active", true)
        .gte("created_at", DATA_CUTOFF)
        .order("created_at", { ascending: true })
        .range(from, to)
    );
    for (const row of clientServices) {
      byId.set(row.id, row);
    }

    // Explicit Resend via FedEx: include active Pending clients outside client_services.
    const missing = Array.from(resendQueuedIds).filter((id) => !byId.has(id));
    for (let i = 0; i < missing.length; i += PAGE_SIZE) {
      const chunk = missing.slice(i, i + PAGE_SIZE);
      const { data, error } = await supabase
        .from("clients")
        .select(ELIGIBLE_CLIENT_SELECT)
        .in("id", chunk)
        .eq("is_active", true);
      if (error) return { clients: [], error: error.message };
      for (const row of (data ?? []) as EligibleClient[]) {
        if (FEDEX_BATCH_EXCLUDED_STAGE_SET.has(row.stage ?? "")) continue;
        byId.set(row.id, row);
      }
    }

    return { clients: Array.from(byId.values()), error: null };
  } catch (err) {
    return {
      clients: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function loadExcludedIds(
  supabase: SupabaseClient
): Promise<{
  primaryShippedIds: Set<string>;
  secondaryShippedIds: Set<string>;
  declinedIds: Set<string>;
  secondaryDeclinedIds: Set<string>;
  resendQueuedIds: Set<string>;
}> {
  const [shipmentRows, declinedRows, secondaryDeclinedRows, pendingRows] =
    await Promise.all([
      fetchAllRows<{
        client_id: string;
        recipient_type: string | null;
        status: string;
      }>((from, to) =>
        supabase
          .from("client_fedex_shipments")
          .select("client_id, recipient_type, status")
          .range(from, to)
      ),
      fetchAllRows<{ client_id: string }>((from, to) =>
        supabase
          .from("audit_log")
          .select("client_id")
          .eq("action", "fedex_declined")
          .range(from, to)
      ),
      fetchAllRows<{ client_id: string }>((from, to) =>
        supabase
          .from("audit_log")
          .select("client_id")
          .eq("action", "fedex_secondary_declined")
          .range(from, to)
      ),
      fetchAllRows<{ client_id: string }>((from, to) =>
        supabase
          .from("client_fedex_shipments")
          .select("client_id")
          .eq("status", "Pending")
          .range(from, to)
      ),
    ]);

  const primaryShippedIds = new Set<string>();
  const secondaryShippedIds = new Set<string>();
  for (const row of shipmentRows) {
    if (row.status === "Pending") continue;
    const clientId = row.client_id;
    const type = row.recipient_type;
    if (type === "secondary") secondaryShippedIds.add(clientId);
    else primaryShippedIds.add(clientId);
  }
  const declinedIds = new Set(declinedRows.map((r) => r.client_id));
  const secondaryDeclinedIds = new Set(
    secondaryDeclinedRows.map((r) => r.client_id)
  );
  const resendQueuedIds = new Set(pendingRows.map((r) => r.client_id));
  return {
    primaryShippedIds,
    secondaryShippedIds,
    declinedIds,
    secondaryDeclinedIds,
    resendQueuedIds,
  };
}

export async function runPendingFedexBatch(
  supabase: SupabaseClient
): Promise<
  | {
      ok: true;
      count: number;
      skipped: number;
      skippedMissingMid: number;
      batchId: string;
      sent: PendingBatchSentRow[];
    }
  | { ok: false; error: string; details?: unknown }
> {
  // Do not call syncPacketsNeededMids / fetchPacketsNeeded here. That path
  // POSTs to Apps Script getMids (same host as the PDF generator) and, when
  // the script hangs or returns a non-array, the send never reached PostLogic
  // or the PDF list. MID is already required below via fedex_merchant / cards.

  // Exclusion sets first — resendQueuedIds is needed to expand the eligible pool.
  const {
    primaryShippedIds,
    secondaryShippedIds,
    declinedIds,
    secondaryDeclinedIds,
    resendQueuedIds,
  } = await loadExcludedIds(supabase);

  const clientsResult = await loadEligibleClients(supabase, resendQueuedIds);

  if (clientsResult.error) {
    return { ok: false, error: clientsResult.error };
  }

  const eligibleRecipients: EligibleRecipient[] = [];
  let skipped = 0;

  for (const c of clientsResult.clients) {
    if (FEDEX_BATCH_EXCLUDED_STAGE_SET.has(c.stage ?? "")) continue;
    // Explicit Resend (Pending marker) overrides a prior fedex_declined.
    if (declinedIds.has(c.id) && !resendQueuedIds.has(c.id)) continue;

    const phone = c.phone_mobile?.trim() || c.phone?.trim();
    if (!phone) {
      skipped++;
      continue;
    }
    const addrWarn = getAddressWarning(c.street_address);
    if (addrWarn) {
      console.log(
        `[BatchCron] Skipping ${c.first_name ?? ""} ${c.last_name ?? ""}: ${addrWarn}`.trim()
      );
      skipped++;
      continue;
    }
    if (
      !c.street_address?.trim() ||
      !c.city?.trim() ||
      !c.state?.trim() ||
      !c.zip_code?.trim()
    ) {
      skipped++;
      continue;
    }

    const primaryAlreadyShipped =
      primaryShippedIds.has(c.id) && !resendQueuedIds.has(c.id);
    if (!primaryAlreadyShipped) {
      eligibleRecipients.push({ client: c, recipientType: "primary" });
    }

    if (
      hasSecondaryPacketLastName(c) &&
      !secondaryShippedIds.has(c.id) &&
      !secondaryDeclinedIds.has(c.id)
    ) {
      eligibleRecipients.push({ client: c, recipientType: "secondary" });
    }
  }

  eligibleRecipients.sort((a, b) =>
    comparePacketsNeededOrder(
      {
        id: a.client.id,
        fedex_queued_at: a.client.fedex_queued_at,
        created_at: a.client.created_at,
        recipient_type: a.recipientType,
      },
      {
        id: b.client.id,
        fedex_queued_at: b.client.fedex_queued_at,
        created_at: b.client.created_at,
        recipient_type: b.recipientType,
      }
    )
  );

  // Missing-MID guard: same rule as Packets Needed "Missing" label —
  // require fedex_merchant or resolvable client_cards merchant.
  const uniqueIds = Array.from(
    new Set(eligibleRecipients.map((r) => r.client.id))
  );
  const cardMerchantMap = await loadCardMerchantMap(supabase, uniqueIds);
  const withMid: EligibleRecipient[] = [];
  let skippedMissingMid = 0;
  const missingLogged = new Set<string>();
  for (const r of eligibleRecipients) {
    const mid = resolveRecipientMerchant(r.client, cardMerchantMap);
    if (!mid) {
      skippedMissingMid++;
      if (!missingLogged.has(r.client.id)) {
        missingLogged.add(r.client.id);
        console.log(
          `[BatchCron] Skipping ${r.client.first_name ?? ""} ${r.client.last_name ?? ""}: Missing MID`.trim()
        );
      }
      continue;
    }
    withMid.push(r);
  }

  console.log(
    `[BatchCron] ${withMid.length} eligible recipients, ${skipped} skipped (incomplete), ${skippedMissingMid} skipped (missing MID)`
  );

  if (!withMid.length) {
    return {
      ok: true,
      count: 0,
      skipped: skipped + skippedMissingMid,
      skippedMissingMid,
      batchId: getTodayBatchId(),
      sent: [],
    };
  }

  const result = await sendFedexRecipients(supabase, withMid, {
    skipCascade: false,
    primaryShippedIds,
    logPrefix: "[BatchCron]",
  });

  if (!result.ok) return result;

  return {
    ok: true,
    count: result.count,
    skipped: skipped + skippedMissingMid,
    skippedMissingMid,
    batchId: result.batchId,
    sent: result.sent,
  };
}
