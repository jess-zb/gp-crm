import {
  ALL_STAGE_ORDER,
  DASHBOARD_PIPELINE_COLORS,
  STAGE_LABELS,
} from "@/lib/constants/stages";

/** Full CRM stage order (main pipeline + outcome stages) for reports and advance/revert. */
export const STAGE_ORDER = ALL_STAGE_ORDER;

export type StageKey = (typeof STAGE_ORDER)[number];

/** @deprecated Prefer STAGE_LABELS from `@/lib/constants/stages` — alias for compatibility. */
export const STAGE_LABEL = STAGE_LABELS;

/** Bar colors for reports / velocity (matches dashboard pipeline). */
export const STAGE_BAR_CLASS: Record<string, string> = { ...DASHBOARD_PIPELINE_COLORS };

/** Stage velocity table order for reports (excludes mortgage). */
export const REPORTS_VELOCITY_ORDER = [
  "lead",
  "account_manager",
  "retention",
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
  "closed",
  "dnc",
] as const;
