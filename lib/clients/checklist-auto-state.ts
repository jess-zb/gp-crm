import { hasSignedPoaOnRecord } from "@/lib/clients/poa-upload-advance";
import { normalizePipelineStage } from "@/lib/clients/pipeline-status";
import {
  CHECKLIST_COLLECTION_ITEM,
  CHECKLIST_POA_ITEM,
  CHECKLIST_WELCOME_PACKET_ITEM,
} from "@/lib/clients/ensure-checklist";

export const POA_DOCUMENT_TYPES = new Set([
  "poa",
  "poa_document",
  "poa_signed",
  "power_of_attorney",
]);

export const COLLECTION_LETTER_AUTO_STAGES = new Set([
  "case_sent_to_attorneys",
  "compliance_verification",
  "mortgage",
]);

export type ChecklistAutoContext = {
  stage: string;
  hasCard: boolean;
  cc_charged_at: string | null;
  hasPoaDocument: boolean;
  poa_signed_at: string | null;
  hasCollectionDoc: boolean;
  hasSignedWelcomePacket: boolean;
};

export type ChecklistItemVisualState = {
  complete: boolean;
  autoChecked: boolean;
  manualChecked: boolean;
  bypassed: boolean;
};

export function isAutoCheckedForChecklistItem(
  label: string,
  ctx: ChecklistAutoContext
): boolean {
  const stage = normalizePipelineStage(ctx.stage);

  switch (label) {
    case CHECKLIST_WELCOME_PACKET_ITEM:
      return stage !== "lead" || ctx.hasSignedWelcomePacket;
    case CHECKLIST_POA_ITEM:
      return hasSignedPoaOnRecord({
        hasPoaDocument: ctx.hasPoaDocument,
        poaSignedAt: ctx.poa_signed_at,
      });
    case CHECKLIST_COLLECTION_ITEM:
      return ctx.hasCollectionDoc || COLLECTION_LETTER_AUTO_STAGES.has(stage);
    default:
      return false;
  }
}

export function getChecklistItemVisualState(
  label: string,
  row: { completed: boolean; bypassed: boolean } | undefined,
  ctx: ChecklistAutoContext
): ChecklistItemVisualState {
  const bypassed = !!row?.bypassed;
  const manualChecked = !!row?.completed && !bypassed;
  const autoChecked =
    !bypassed && !manualChecked && isAutoCheckedForChecklistItem(label, ctx);
  const complete = bypassed || manualChecked || autoChecked;

  return { complete, autoChecked, manualChecked, bypassed };
}
