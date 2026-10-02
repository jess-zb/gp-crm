/**
 * Stable keys for reminders.appointment_type_key — preserves legacy label/description inference.
 * Modal label → key map is generated from `workflow-config.ts` so labels stay in sync.
 */

import {
  buildModalAppointmentLabelToKey,
  getWorkflowType,
  inferPipelineFromClientStage,
  type WorkflowDepartment,
  type WorkflowTypeConfig,
} from "@/lib/reminders/workflow-config";

export type { WorkflowDepartment };

/** Modal dropdown labels → keys (single source: WORKFLOW_TYPES in workflow-config). */
export const APPOINTMENT_LABEL_TO_KEY = buildModalAppointmentLabelToKey();

/** Sidebar quick picks may differ slightly from modal strings — map to the same keys where intended */
const SIDEBAR_DESCRIPTION_ALIASES: Record<string, string> = {
  "CS Intro Call": "cs_intro_call",
  "All Cards Charged": "all_cards_charged",
  "Retention Call": "retention_call",
  "Packet Sent": "packet_sent",
  "Check-In Waiting Call": "waiting_call_collection",
  "60 Day Call": "sixty_day_call",
  "90 Day Call": "ninety_day_call",
  "Case Sent Call": "case_sent_call",
  "DNC Confirmed": "dnc_confirmed",
  "24 HR Call": "twenty_four_hr_call",
  "48 HR Call": "forty_eight_hr_call",
  "7 Day Call": "seven_day_call",
  "AM Enrollment Follow-Up": "seven_day_call",
  "30 Day Call": "thirty_day_call",
};


export function slugifyForKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Deterministic key for template-generated reminders */
export function templateReminderKey(stage: string, title: string): string {
  const st = slugifyForKey(stage);
  const ti = slugifyForKey(title);
  return ti ? `tpl_${st}_${ti}` : `tpl_${st}_task`;
}

/** Free-text descriptions (sidebar custom, imports) — stable hashless slug */
export function stableKeyFromFreeText(description: string): string {
  const s = slugifyForKey(description);
  return s ? `free_${s}` : "free_text";
}

const LABEL_TO_KEY = APPOINTMENT_LABEL_TO_KEY as Record<string, string>;

/**
 * Resolve persisted `appointment_type_key` from legacy columns.
 * @legacy Falls back to `free_*` slug for unknown free text — grouping uses "Other" bucket in UI.
 */
export function resolveAppointmentTypeKey(opts: {
  appointment_type?: string | null;
  description?: string | null;
}): string | null {
  const at = opts.appointment_type?.trim();
  if (at) {
    const byLabel = LABEL_TO_KEY[at];
    if (byLabel) return byLabel;
    const slug = slugifyForKey(at);
    return slug ? `label_${slug}` : null;
  }
  const desc = opts.description?.trim();
  if (!desc) return null;
  const alias = SIDEBAR_DESCRIPTION_ALIASES[desc];
  if (alias) return alias;
  const byDesc = LABEL_TO_KEY[desc];
  if (byDesc) return byDesc;
  return stableKeyFromFreeText(desc);
}

/** Merge inferred key with WORKFLOW_TYPES (null / unknown keys → DEFAULT_UNKNOWN in config). */
export function getWorkflowTypeFromLegacyReminder(row: {
  appointment_type_key?: string | null;
  appointment_type?: string | null;
  description?: string | null;
}): WorkflowTypeConfig {
  const inferred =
    row.appointment_type_key?.trim() ||
    resolveAppointmentTypeKey({
      appointment_type: row.appointment_type,
      description: row.description,
    });
  return getWorkflowType(inferred);
}

/**
 * Operational department (queue). Dual-written alongside legacy `pipeline_type`.
 * @legacy Order of checks preserved (retention / service stages / explicit pipeline / inferred tab).
 */
export function inferDepartment(opts: {
  clientStage: string | null | undefined;
  pipelineType?: string | null;
}): WorkflowDepartment {
  const s = (opts.clientStage ?? "").trim();

  if (s === "retention") return "retention";
  if (s === "case_sent_to_attorneys") return "legal";
  if (s === "client_services" || s === "awaiting_collection_letter") return "service";

  const pt = opts.pipelineType?.trim();
  if (pt === "service") return "service";
  if (pt === "sales") return "sales";

  const inferred = inferPipelineFromClientStage(s);
  return inferred === "service" ? "service" : "sales";
}
