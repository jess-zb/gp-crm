import { getStageLabel, isPipelineStageHidden } from "@/lib/constants/stages";
import { normalizePipelineStage } from "@/lib/clients/pipeline-status";

export type StageDropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

const TERMINAL_NO_SELECT = new Set([
  "dnc",
  "not_interested",
  "dnq",
  "mortgage",
  "closed",
]);

/** Visible pipeline destinations (Compliance hidden). */
const PIPELINE_DROPDOWN_STAGES = [
  "lead",
  "welcome_packet",
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
  "closed",
] as const;

function option(value: string, disabled?: boolean): StageDropdownOption {
  return {
    value,
    label: getStageLabel(value),
    ...(disabled ? { disabled: true } : {}),
  };
}

/**
 * Stage dropdown next to client name. Returns `null` when the current stage should not
 * show a pipeline selector (terminal / non-pipeline states except closed is handled via isClosed UI).
 */
export function getStageDropdownOptions(
  currentStage: string | null
): StageDropdownOption[] | null {
  const s = normalizePipelineStage(currentStage);
  if (TERMINAL_NO_SELECT.has(s)) {
    return null;
  }

  if (s === "retention") {
    return [
      option("retention", true),
      option("welcome_packet"),
      option("client_services"),
      option("awaiting_collection_letter"),
      option("case_sent_to_attorneys"),
      option("closed"),
      option("dnc"),
    ];
  }

  // Stranded clients on hidden Compliance — show current + allowed forward destinations.
  if (isPipelineStageHidden(s)) {
    return [
      option(s, true),
      option("welcome_packet"),
      option("client_services"),
      option("awaiting_collection_letter"),
      option("case_sent_to_attorneys"),
      option("closed"),
    ];
  }

  // New Lead: only Account Manager is selectable forward (Cancel handles Retention).
  if (s === "lead") {
    return PIPELINE_DROPDOWN_STAGES.map((value) =>
      option(value, value !== "lead" && value !== "welcome_packet")
    );
  }

  return PIPELINE_DROPDOWN_STAGES.map((value) => option(value));
}

export function getStageDropdownOptionLabel(
  currentStage: string | null,
  value: string
): string {
  const opts = getStageDropdownOptions(currentStage);
  const hit = opts?.find((o) => o.value === value);
  return hit?.label ?? value;
}
