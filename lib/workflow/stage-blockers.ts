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

export const WELCOME_PACKET_GATE_TITLE = "Welcome Packet not signed yet";

export const WELCOME_PACKET_GATE_REASON =
  "This client has not signed the Welcome Packet. Send it for e-signature from Documents, or upload the signed copy there, before moving them out of Account Manager.";

/**
 * Cannot leave Account Manager until the Welcome Packet is signed. The signed
 * copy lands as a POA document (or sets `poa_signed_at`), whether it arrived
 * through e-signature or a manual upload, so both satisfy the gate.
 */
export function blockAdvanceFromAccountManagerWithoutSignedWelcomePacket(opts: {
  fromStage: string;
  toStage: string;
  poaSignedAt?: string | null;
  hasPoaDocument?: boolean;
}): StageAdvanceBlock {
  const from = opts.fromStage.trim();
  const to = opts.toStage.trim();

  if (
    from === "account_manager" &&
    to !== "account_manager" &&
    !isExitFromPipeline(to) &&
    !hasSignedPoaOnRecord({
      poaSignedAt: opts.poaSignedAt,
      hasPoaDocument: opts.hasPoaDocument,
    })
  ) {
    return { blocked: true, reason: WELCOME_PACKET_GATE_REASON };
  }

  return { blocked: false };
}

/** Cancel / disqualify destinations are never gated on paperwork. */
function isExitFromPipeline(stage: string): boolean {
  return ["retention", "dnc", "not_interested", "dnq", "mortgage", "closed"].includes(
    stage
  );
}
