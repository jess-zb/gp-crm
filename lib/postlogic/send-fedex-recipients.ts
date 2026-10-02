import type { SupabaseClient } from "@supabase/supabase-js";
import { omitCarrierStatus, retryWriteWithoutCarrierStatus } from "@/lib/packets/carrier-status-column";
import { getTodayBatchId } from "./batch-helpers";
import { getPostlogicXApiKey, POSTLOGIC_INTAKE_URL, POSTLOGIC_PARTNER } from "./constants";

const PAGE_SIZE = 1000;
const ID_PREFIX = "DSP";
const ID_WIDTH = 3;

export type FedexSendClient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  phone_mobile: string | null;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  assigned_to: string | null;
  fedex_merchant: string | null;
  fedex_queued_at?: string | null;
  created_at?: string | null;
};

export type FedexSendRecipient = {
  client: FedexSendClient;
  recipientType: "primary" | "secondary";
};

export type FedexSentRow = {
  clientId: string;
  name: string;
  advisor: string;
  merchant: string;
};

export type SendFedexRecipientsResult =
  | { ok: true; count: number; batchId: string; sent: FedexSentRow[] }
  | { ok: false; error: string; details?: unknown };

async function getNextUniqueIdNum(supabase: SupabaseClient): Promise<number> {
  let maxNum = 0;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("clients")
      .select("postlogic_unique_id")
      .like("postlogic_unique_id", `${ID_PREFIX}%`)
      .not("postlogic_unique_id", "is", null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`getNextUniqueIdNum: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      const id = (row.postlogic_unique_id as string | null)?.trim() ?? "";
      const m = id.match(new RegExp(`^${ID_PREFIX}(\\d+)$`, "i"));
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return maxNum + 1;
}

function parseDuplicateIdNum(msg: string | undefined): number | null {
  if (!msg) return null;
  // Intake returns: payload[i]: unique_id "DSP686" already exists
  const m = msg.match(
    new RegExp(
      `unique_id\\s+"?${ID_PREFIX}(\\d+)"?\\s+already\\s+exists`,
      "i"
    )
  );
  return m ? parseInt(m[1], 10) : null;
}

function idsFromPostlogicResult(
  result: Record<string, unknown>,
  count: number
): string[] | null {
  const ids = result.ids;
  if (!Array.isArray(ids) || ids.length !== count) return null;
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !id.trim()) return null;
    out.push(id.trim());
  }
  return out;
}

function recipientDisplayName(
  c: FedexSendClient,
  type: "primary" | "secondary"
): string {
  if (type === "secondary") {
    return `${c.spouse_first_name ?? ""} ${c.spouse_last_name ?? ""}`.trim();
  }
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
}

/** Secondary packets require spouse last name on file. */
export function hasSecondaryPacketLastName(c: {
  spouse_last_name: string | null;
}): boolean {
  return Boolean(c.spouse_last_name?.trim());
}

/** Majority merchant from client_cards for the given client ids. */
export async function loadCardMerchantMap(
  supabase: SupabaseClient,
  clientIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!clientIds.length) return map;

  const { data: cards } = await supabase
    .from("client_cards")
    .select("client_id, merchant_name")
    .in("client_id", clientIds)
    .not("merchant_name", "is", null);

  const cardGroups = new Map<string, Map<string, number>>();
  for (const card of cards ?? []) {
    const cid = card.client_id as string;
    const m = (card.merchant_name as string | null)?.trim();
    if (!m) continue;
    if (!cardGroups.has(cid)) cardGroups.set(cid, new Map());
    const g = cardGroups.get(cid)!;
    g.set(m, (g.get(m) ?? 0) + 1);
  }

  for (const [cid, counts] of Array.from(cardGroups.entries())) {
    let best: string | null = null;
    let bestCount = 0;
    for (const [m, count] of Array.from(counts.entries())) {
      if (count > bestCount) {
        best = m;
        bestCount = count;
      }
    }
    if (best) map.set(cid, best);
  }
  return map;
}

/**
 * Resolve MID the same way Packets Needed UI does:
 * fedex_merchant, else majority client_cards merchant.
 */
export function resolveRecipientMerchant(
  client: FedexSendClient,
  cardMerchantMap: Map<string, string>
): string | null {
  const fromField = client.fedex_merchant?.trim();
  if (fromField) return fromField;
  return cardMerchantMap.get(client.id)?.trim() || null;
}

export type SendFedexRecipientsOptions = {
  /** Skip Delivered→Archived / in-flight→Delivered cascade (manual/single sends). */
  skipCascade?: boolean;
  /** Client ids that already had a primary shipped (for secondary_auto_queued audit). */
  primaryShippedIds?: Set<string>;
  logPrefix?: string;
};

/**
 * Send recipients to PostLogic and write shipment/client rows.
 * Callers own eligibility filtering, sorting, and PDF push.
 */
export async function sendFedexRecipients(
  supabase: SupabaseClient,
  recipients: FedexSendRecipient[],
  opts: SendFedexRecipientsOptions = {}
): Promise<SendFedexRecipientsResult> {
  const logPrefix = opts.logPrefix ?? "[FedexSend]";
  if (!recipients.length) {
    return { ok: true, count: 0, batchId: getTodayBatchId(), sent: [] };
  }

  const uniqueClients = Array.from(
    new Map(recipients.map((r) => [r.client.id, r.client])).values()
  );

  const advisorIds = Array.from(
    new Set(uniqueClients.map((c) => c.assigned_to).filter(Boolean) as string[])
  );
  const profileMap = new Map<string, string>();
  if (advisorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", advisorIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id as string, (p.full_name as string | null) ?? "");
    }
  }

  const merchantMap = new Map<string, string>();
  for (const c of uniqueClients) {
    if (c.fedex_merchant?.trim()) merchantMap.set(c.id, c.fedex_merchant.trim());
  }
  const needsMerchant = uniqueClients
    .filter((c) => !merchantMap.has(c.id))
    .map((c) => c.id);
  if (needsMerchant.length) {
    const fromCards = await loadCardMerchantMap(supabase, needsMerchant);
    for (const [cid, m] of Array.from(fromCards.entries())) {
      merchantMap.set(cid, m);
    }
  }

  const batchId = getTodayBatchId();
  const sentAt = new Date().toISOString();

  function buildAssignments(startNum: number) {
    return recipients.map((r, i) => ({
      client: r.client,
      recipientType: r.recipientType,
      uniqueId: `${ID_PREFIX}${String(startNum + i).padStart(ID_WIDTH, "0")}`,
    }));
  }

  function buildPayload(
    assigns: ReturnType<typeof buildAssignments>
  ): (string | number)[][] {
    return assigns.map(({ client: c, recipientType, uniqueId }) => [
      batchId,
      POSTLOGIC_PARTNER,
      uniqueId,
      recipientDisplayName(c, recipientType),
      c.phone_mobile?.trim() || c.phone?.trim() || "",
      c.street_address ?? "",
      c.city ?? "",
      c.state ?? "",
      c.zip_code ?? "",
      "Processing",
      "",
    ]);
  }

  const bearer = process.env.POSTLOGIC_BEARER?.trim();
  if (!bearer) {
    return { ok: false, error: "POSTLOGIC_BEARER is not configured" };
  }

  const endpoint = process.env.POSTLOGIC_ENDPOINT?.trim() || POSTLOGIC_INTAKE_URL;

  let startNum = await getNextUniqueIdNum(supabase);
  let assignments = buildAssignments(startNum);
  let postlogicResult: Record<string, unknown> = {};
  const MAX_DUP_RETRIES = 20;
  let sendOk = false;

  for (let attempt = 0; attempt <= MAX_DUP_RETRIES; attempt++) {
    const payload = buildPayload(assignments);
    let postlogicRes: Response;
    let rawText = "";
    try {
      postlogicRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": getPostlogicXApiKey(),
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({ payload }),
        signal: AbortSignal.timeout(60_000),
      });
      rawText = await postlogicRes.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Print partner request failed: ${msg}` };
    }
    try {
      postlogicResult = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    } catch {
      return { ok: false, error: "Print partner returned invalid JSON" };
    }

    const statusField =
      typeof postlogicResult.status === "string" ? postlogicResult.status : undefined;
    const message =
      typeof postlogicResult.message === "string" ? postlogicResult.message : undefined;

    if (postlogicRes.ok && statusField !== "error") {
      sendOk = true;
      break;
    }

    const dupNum = parseDuplicateIdNum(message);
    if (dupNum == null) {
      console.error(
        `${logPrefix} PostLogic rejected batch:`,
        postlogicRes.status,
        rawText.slice(0, 500)
      );
      return {
        ok: false,
        error: message || "Print partner rejected the batch",
      };
    }

    const nextStart = Math.max(startNum + 1, dupNum + 1);
    console.warn(
      `${logPrefix} PostLogic reported ${ID_PREFIX}${dupNum} exists — bumping startNum ${startNum} → ${nextStart} (attempt ${attempt + 1}/${MAX_DUP_RETRIES})`
    );
    startNum = nextStart;
    assignments = buildAssignments(startNum);
  }

  if (!sendOk) {
    return {
      ok: false,
      error: `Print partner rejected the batch after ${MAX_DUP_RETRIES} duplicate-ID retries — investigate PostLogic ledger drift`,
    };
  }

  const allocatedIds = idsFromPostlogicResult(
    postlogicResult,
    assignments.length
  );
  if (allocatedIds) {
    assignments = assignments.map((row, i) => ({
      ...row,
      uniqueId: allocatedIds[i]!,
    }));
  } else {
    console.warn(
      `${logPrefix} PostLogic did not return ${assignments.length} unique ids — falling back to CRM-generated DSP numbers`
    );
  }

  if (!opts.skipCascade) {
    await supabase
      .from("client_fedex_shipments")
      .update({ status: "Archived" })
      .eq("status", "Delivered");
    // Tab only — do not stamp delivered_at; FedEx may still be In Transit.
    await supabase
      .from("client_fedex_shipments")
      .update({ status: "Delivered" })
      .eq("status", "Processing");
  }

  const primaryShippedIds = opts.primaryShippedIds ?? new Set<string>();
  const clientUpdated = new Set<string>();
  for (const { client: c, recipientType, uniqueId } of assignments) {
    const displayName = recipientDisplayName(c, recipientType);
    const recipientName = displayName.toUpperCase();
    const advisorName = c.assigned_to ? (profileMap.get(c.assigned_to) ?? null) : null;
    const merchant = merchantMap.get(c.id) ?? null;

    const insertRow = {
      client_id: c.id,
      recipient_name: recipientName,
      recipient_type: recipientType,
      carrier: "FedEx",
      batch_id: batchId,
      batch_date: batchId,
      status: "Processing" as const,
      carrier_status: "Processing",
      sent_at: sentAt,
      advisor: advisorName,
      merchant,
      street_address: c.street_address,
      city: c.city,
      state: c.state,
      zip_code: c.zip_code,
      phone: c.phone_mobile?.trim() || c.phone?.trim() || null,
    };
    await retryWriteWithoutCarrierStatus(
      () => supabase.from("client_fedex_shipments").insert(insertRow),
      () =>
        supabase
          .from("client_fedex_shipments")
          .insert(omitCarrierStatus(insertRow))
    );

    if (recipientType === "secondary" && primaryShippedIds.has(c.id)) {
      const { error: auditErr } = await supabase.from("audit_log").insert({
        client_id: c.id,
        action: "secondary_auto_queued",
        new_value: {
          batch_id: batchId,
          recipient_name: displayName,
          reason: "spouse_added_after_primary_sent",
        },
      });
      if (auditErr) {
        console.warn(`${logPrefix} secondary_auto_queued audit failed:`, auditErr.message);
      }
    }

    if (!clientUpdated.has(c.id)) {
      clientUpdated.add(c.id);
      await supabase
        .from("clients")
        .update({
          postlogic_status: "Sent to Printer",
          postlogic_unique_id: uniqueId,
          fedex_batch_sent_at: sentAt,
          batch_id: batchId,
          ...(merchant && !c.fedex_merchant?.trim()
            ? { fedex_merchant: merchant }
            : {}),
        })
        .eq("id", c.id);

      await supabase
        .from("client_fedex_shipments")
        .delete()
        .eq("client_id", c.id)
        .eq("status", "Pending");
    }
  }

  const sent: FedexSentRow[] = assignments.map(({ client: c, recipientType }) => ({
    clientId: c.id,
    name: recipientDisplayName(c, recipientType),
    advisor: c.assigned_to ? (profileMap.get(c.assigned_to) ?? "") : "",
    merchant: merchantMap.get(c.id) ?? "",
  }));

  return { ok: true, count: assignments.length, batchId, sent };
}
