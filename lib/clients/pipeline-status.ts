import {
  ALL_STAGE_ORDER,
  PIPELINE_STAGE_ORDER,
  STAGE_LABELS,
  isPipelineStageHidden,
  normalizeStageKey,
} from "@/lib/constants/stages";

/** Settings + profile header: all valid stages in CRM order (excludes hidden stages). */
export const PIPELINE_STATUS_OPTIONS = ALL_STAGE_ORDER.filter(
  (value) => !isPipelineStageHidden(value)
).map((value) => ({
  value,
  label: STAGE_LABELS[value] ?? value,
}));

export function normalizePipelineStage(raw: string | null | undefined): string {
  return normalizeStageKey(raw);
}

/** Stages that leave the working pipeline. Archives includes these even if `is_active` was left true. */
export const ARCHIVE_STAGES = [
  "dnc",
  "not_interested",
  "dnq",
  "mortgage",
  "closed",
] as const;

export function isArchiveStage(stage: string | null | undefined): boolean {
  return (ARCHIVE_STAGES as readonly string[]).includes((stage ?? "").trim());
}

/**
 * `false` when the move archives the file, `true` when it leaves an archive
 * stage, otherwise leave `is_active` untouched.
 */
export function isActiveForStageMove(
  oldStage: string,
  newStage: string
): boolean | undefined {
  if (isArchiveStage(newStage)) return false;
  if (isArchiveStage(oldStage)) return true;
  return undefined;
}

export function pipelineStageAuditAction(
  oldStage: string,
  newStage: string
): "stage_advanced" | "stage_reverted" {
  const order = ALL_STAGE_ORDER as readonly string[];
  const io = order.indexOf(oldStage);
  const in_ = order.indexOf(newStage);
  if (io >= 0 && in_ >= 0) {
    if (in_ > io) return "stage_advanced";
    if (in_ < io) return "stage_reverted";
    return "stage_advanced";
  }
  return newStage >= oldStage ? "stage_advanced" : "stage_reverted";
}

/**
 * Whether `newStage` is strictly later than `oldStage` on the main CRM pipeline
 * (`PIPELINE_STAGE_ORDER`). Used for reminder workflow + entry side-effects so the
 * stage dropdown matches linear "advance" behavior even when audit order uses
 * `ALL_STAGE_ORDER` (e.g. lead → account_manager).
 */
export function isForwardPipelineTransition(oldStage: string, newStage: string): boolean {
  const order = PIPELINE_STAGE_ORDER as readonly string[];
  const io = order.indexOf(oldStage as (typeof PIPELINE_STAGE_ORDER)[number]);
  const in_ = order.indexOf(newStage as (typeof PIPELINE_STAGE_ORDER)[number]);
  if (io >= 0 && in_ >= 0) {
    return in_ > io;
  }
  return pipelineStageAuditAction(oldStage, newStage) === "stage_advanced";
}

/**
 * True when a forward move would improperly skip required early-pipeline stages.
 * Primary guard: New Lead may only advance to Account Manager (`account_manager`).
 * Retention (Cancel path) is exempt.
 * Later-stage jumps keep existing gates (Welcome Packet, POA, Retention exit modal).
 */
export function wouldSkipPipelineStages(oldStage: string, newStage: string): boolean {
  if (isPipelineStageHidden(oldStage) || isPipelineStageHidden(newStage)) {
    return false;
  }
  if (oldStage === "retention" || newStage === "retention") {
    return false;
  }
  if (oldStage !== "lead") {
    return false;
  }
  // From New Lead, only Account Manager is a valid forward destination via stage UI.
  return newStage !== "account_manager";
}
