/**
 * Lightweight workflow gates before clients.stage changes (Phase 4).
 * Extend with DB-backed requirements later — today uses existing client facts only.
 */

import { hasSignedPoaOnRecord } from "@/lib/clients/poa-upload-advance";

export type StageAdvanceBlock = {
  blocked: boolean;
  reason?: string;
};

/**
 * Cannot leave Client Services for Awaiting Collection Letter until signed POA exists on the client record.
 * (Upload flows may still advance stage via triggers — this guards manual Advance.)
 */
export function blockAdvanceFromClientServicesWithoutPoa(opts: {
  fromStage: string;
  toStage: string;
  poaSignedAt?: string | null;
  hasPoaDocument?: boolean;
}): StageAdvanceBlock {
  const from = opts.fromStage.trim();
  const to = opts.toStage.trim();

  if (
    from === "client_services" &&
    to === "awaiting_collection_letter" &&
    !hasSignedPoaOnRecord({
      poaSignedAt: opts.poaSignedAt,
      hasPoaDocument: opts.hasPoaDocument,
    })
  ) {
    return {
      blocked: true,
      reason:
        "A signed POA must be on file before advancing to Awaiting Collections. Upload the POA in Documents.",
    };
  }

  return { blocked: false };
}

export const CC_AUTH_GATE_TITLE = "Credit card authorization not signed yet";

export const CC_AUTH_GATE_REASON =
  "This client has not signed the credit card authorization. Send it for e-signature from Documents, or upload the signed copy there, before moving them out of Account Manager.";

/** A filed `cc_authorization` — e-sign completion or a direct upload — satisfies the gate. */
export function hasCcAuthorizationOnRecord(
  documentTypes: Iterable<string | null | undefined>
): boolean {
  return Array.from(documentTypes).some(
    (raw) => (raw ?? "").trim().toLowerCase() === "cc_authorization"
  );
}

/**
 * Cannot leave Account Manager for a later pipeline stage until a signed credit
 * card authorization is on file. Cancel and disqualify destinations stay open.
 */
export function blockAdvanceFromAccountManagerWithoutCcAuth(opts: {
  fromStage: string;
  toStage: string;
  hasCcAuthorization?: boolean;
}): StageAdvanceBlock {
  const from = opts.fromStage.trim();
  const to = opts.toStage.trim();

  if (
    from === "account_manager" &&
    to !== "account_manager" &&
    !isExitFromPipeline(to) &&
    !opts.hasCcAuthorization
  ) {
    return { blocked: true, reason: CC_AUTH_GATE_REASON };
  }

  return { blocked: false };
}

/** Cancel / disqualify destinations are never gated on paperwork. */
function isExitFromPipeline(stage: string): boolean {
  return ["retention", "dnc", "not_interested", "dnq", "mortgage", "closed"].includes(
    stage
  );
}
