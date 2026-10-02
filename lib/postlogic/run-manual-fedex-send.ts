import type { SupabaseClient } from "@supabase/supabase-js";
import { getAddressWarning } from "@/lib/utils/address-validation";
import {
  loadCardMerchantMap,
  resolveRecipientMerchant,
  sendFedexRecipients,
  hasSecondaryPacketLastName,
  type FedexSendClient,
  type FedexSendRecipient,
  type FedexSentRow,
} from "./send-fedex-recipients";

const CLIENT_SELECT =
  "id, first_name, last_name, spouse_first_name, spouse_last_name, phone_mobile, phone, street_address, city, state, zip_code, assigned_to, fedex_merchant, fedex_queued_at, created_at, stage, is_active";

export type ManualFedexSendResult =
  | {
      ok: true;
      count: number;
      batchId: string;
      sent: FedexSentRow[];
    }
  | { ok: false; error: string };

/**
 * Send one Packets Needed row (primary or secondary) through PostLogic +
 * shipment/client updates. Skips batch cascade. Used by the dev-only manual
 * send button and one-off scripts.
 */
export async function runManualFedexSend(
  supabase: SupabaseClient,
  opts: {
    clientId: string;
    recipientType: "primary" | "secondary";
    /** When true, allow send even if stage is not client_services (one-offs). */
    allowAnyStage?: boolean;
    /** When true, allow inactive clients (e.g. DNC one-offs). */
    allowInactive?: boolean;
    /** When true, allow send even without a resolvable MID. */
    allowMissingMid?: boolean;
  }
): Promise<ManualFedexSendResult> {
  const { clientId, recipientType } = opts;

  const { data: row, error } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("id", clientId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "Client not found" };

  const client = row as FedexSendClient & {
    stage: string | null;
    is_active: boolean | null;
  };

  if (!client.is_active && !opts.allowInactive) {
    return { ok: false, error: "Client is inactive" };
  }
  if (!opts.allowAnyStage && client.stage !== "client_services") {
    return {
      ok: false,
      error: `Client stage is "${client.stage ?? "null"}" — expected client_services`,
    };
  }

  const phone = client.phone_mobile?.trim() || client.phone?.trim();
  if (!phone) return { ok: false, error: "Client is missing a phone number" };

  const addrWarn = getAddressWarning(client.street_address);
  if (addrWarn) return { ok: false, error: addrWarn };

  if (
    !client.street_address?.trim() ||
    !client.city?.trim() ||
    !client.state?.trim() ||
    !client.zip_code?.trim()
  ) {
    return { ok: false, error: "Client address is incomplete" };
  }

  if (recipientType === "secondary") {
    if (!hasSecondaryPacketLastName(client)) {
      return {
        ok: false,
        error: "Secondary packet requires spouse last name on file",
      };
    }
  }

  const cardMap = await loadCardMerchantMap(supabase, [clientId]);
  const merchant = resolveRecipientMerchant(client, cardMap);
  if (!merchant && !opts.allowMissingMid) {
    return {
      ok: false,
      error: "Missing MID — set fedex_merchant or add client_cards merchant first",
    };
  }

  const recipients: FedexSendRecipient[] = [
    { client, recipientType },
  ];

  // Detect whether primary already shipped (non-Pending) for secondary audit.
  const { data: primaryShip } = await supabase
    .from("client_fedex_shipments")
    .select("id")
    .eq("client_id", clientId)
    .neq("status", "Pending")
    .or("recipient_type.eq.primary,recipient_type.is.null")
    .limit(1);
  const primaryShippedIds = new Set<string>();
  if (primaryShip?.length) primaryShippedIds.add(clientId);

  const result = await sendFedexRecipients(supabase, recipients, {
    skipCascade: true,
    primaryShippedIds,
    logPrefix: "[ManualFedexSend]",
  });

  if (!result.ok) return result;
  return {
    ok: true,
    count: result.count,
    batchId: result.batchId,
    sent: result.sent,
  };
}
