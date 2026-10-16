/**
 * What an uploaded file does to the stage.
 * The database triggers in 0033_document_stage_advances.sql must follow the same rules.
 *
 * Credit card form, from New Lead or Account Manager:
 *   - Welcome Packet already on file → Awaiting Collections
 *   - otherwise → Client Services
 * Welcome Packet:
 *   - Client Services → Awaiting Collections
 *   - New Lead or Account Manager, and the credit card form is already on file → Awaiting Collections
 *   - New Lead with no credit card form → Account Manager
 *   - Account Manager with no credit card form → stay put
 */

export const CLIENT_SERVICES_STAGE = "client_services";
export const WAITING_COLLECTION_STAGE = "awaiting_collection_letter";

export function stageAfterCcAuthorizationUpload(
  fromStage: string,
  hasWelcomePacket: boolean
): string | null {
  const from = fromStage.trim();
  if (from !== "lead" && from !== "account_manager") return null;
  return hasWelcomePacket ? WAITING_COLLECTION_STAGE : CLIENT_SERVICES_STAGE;
}

export function stageAfterWelcomePacketUpload(
  fromStage: string,
  hasCcAuthorization: boolean
): string | null {
  const from = fromStage.trim();
  if (from === CLIENT_SERVICES_STAGE) return WAITING_COLLECTION_STAGE;
  if ((from === "lead" || from === "account_manager") && hasCcAuthorization) {
    return WAITING_COLLECTION_STAGE;
  }
  if (from === "lead") return "account_manager";
  return null;
}

export function ccAdvanceAlreadyApplied(stageBefore: string, stageNow: string): boolean {
  const from = stageBefore.trim();
  return (
    (from === "lead" || from === "account_manager") &&
    (stageNow === CLIENT_SERVICES_STAGE || stageNow === WAITING_COLLECTION_STAGE)
  );
}

export const CC_AUTH_TO_CLIENT_SERVICES_TOAST =
  "Credit card form saved. This client moved to Client Services.";

export const CC_AUTH_TO_WAITING_TOAST =
  "Credit card form saved. The Welcome Packet was already on file, so this client moved to Awaiting Collections.";

export const WELCOME_PACKET_TO_WAITING_TOAST =
  "Welcome Packet saved — client advanced to Awaiting Collection Letter";

export const WELCOME_PACKET_STAYS_TOAST =
  "Welcome Packet saved. This client stays in Account Manager until the credit card form is uploaded.";

export const WELCOME_PACKET_TO_ACCOUNT_MANAGER_TOAST =
  "Welcome Packet saved. This client moved to Account Manager.";

/** Staff toast after the file is saved. Null means the generic "File uploaded" line is enough. */
export function uploadStageMessage(args: {
  kind: "cc_authorization" | "welcome_packet";
  fromStage: string;
  toStage: string;
}): string | null {
  const from = args.fromStage.trim();
  const to = args.toStage.trim();
  if (args.kind === "cc_authorization") {
    if (to === CLIENT_SERVICES_STAGE && from !== to) return CC_AUTH_TO_CLIENT_SERVICES_TOAST;
    if (to === WAITING_COLLECTION_STAGE && from !== to) return CC_AUTH_TO_WAITING_TOAST;
    return null;
  }
  if (to === WAITING_COLLECTION_STAGE && from !== to) return WELCOME_PACKET_TO_WAITING_TOAST;
  if (from === "lead" && to === "account_manager") return WELCOME_PACKET_TO_ACCOUNT_MANAGER_TOAST;
  if (from === "account_manager" && to === "account_manager") return WELCOME_PACKET_STAYS_TOAST;
  return null;
}
