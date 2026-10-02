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
