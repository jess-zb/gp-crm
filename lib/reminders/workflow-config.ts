/**
 * Centralized workflow definitions for reminders / appointments (stabilization layer).
 *
 * This file does NOT replace DB columns; it describes behavior, SLA intent, and UI/analytics hooks.
 * Orchestration in `workflow.ts` + `workflow-keys.ts` continues to persist rows; consume this config
 * when adding calendar, SLA reports, or stage gates — without schema churn.
 *
 * ─── Workflow lanes (how to think about departments) ─────────────────────────────────
 *
 * SALES (department `sales`):
 *   Early funnel: lead → account_manager → client_services. Focus: dialer-style follow-ups,
 *   auth/charge milestones, prospecting. Most `follow_up_*` tasks live here.
 *
 * RETENTION (department `retention`):
 *   Salvage / save attempts when client is in `retention` stage. Tasks are labeled distinctly so
 *   ops can prioritize win-back work separately from net-new sales.
 *
 * SERVICE (department `service`):
 *   Post-sale operations: welcome packet, POA, awaiting collection letter, client touchpoints
 *   until attorney handoff is fully baked. Packet-sent / delivery confirmations are service-owned.
 *
 * LEGAL HANDOFF (department `legal`):
 *   Visibility queue around `case_sent_to_attorneys` — CRM still coordinates client comms and proof
 *   of submissions; attorneys use their own portal downstream. Config flags here support SLA on
 *   “case sent” callouts without implying legal staff use this CRM as their primary task system.
 *
 * Future: recurring tasks, drag/drop calendar rescheduling, and creditor/card-level collection-letter
 * tracking can read the same keys and extend these objects without renaming columns.
 */

import { PIPELINE_STAGE_ORDER } from "@/lib/constants/stages";
import {
  blockAdvanceFromAccountManagerWithoutCcAuth,
  blockAdvanceFromClientServicesWithoutPoa,
} from "@/lib/workflow/stage-blockers";

/** Operational queue — persisted on `reminders.department`; dual-written with legacy `pipeline_type` until removed. */
export type WorkflowDepartment = "sales" | "retention" | "service" | "legal";

// ─── Types ─────────────────────────────────────────────────────────────────────────────

/** Semantic bucket for calendar chips / drag-drop targets (future). */
export type CalendarCategory =
  | "sales_follow_up"
  | "retention"
  | "service_ops"
  | "legal_handoff"
  | "generic";

/** Events that may trigger server-side auto-completion. */
export type AutoCompleteEvent =
  | { type: "collection_letter_recorded" }
  | { type: "stage_transition"; fromStage: string; toStage: string }
  | { type: "manual" };

export type WorkflowTypeConfig = {
  /** Human-readable label for UI, reporting, and inferred legacy rows */
  label: string;
  /** Primary operational queue — aligns with `reminders.department` when set */
  department: WorkflowDepartment;
  /** Pipeline stages where this task type is normally created / meaningful */
  stages: readonly string[];
  /** If false, automation may complete without user clicking Complete (subject to event rules). */
  manualCompletion: boolean;
  /** When true, open instances of this type may prevent stage advance until completed or cancelled (future UI). */
  blocksStageAdvance: boolean;
  /** Default offset from creation / anchor for due_date (hours). Template rows often override via DB template hours. */
  dueHours: number;
  /** SLA clock for dashboards / overdue (hours); often equals dueHours unless escalated. */
  slaHours: number;
  /** Show in future calendar aggregation queries (feature-flag friendly). */
  showInCalendar: boolean;
  /** Tailwind-friendly token for calendar month/week views (future). */
  calendarColor: string;
  /** Soft-cancel when orchestration moves client backward past relevant stages */
  autoCancelOnStageBackward: boolean;
  /** Future: RRULE or cadence id — undefined = one-shot */
  recurrence?: "none" | "daily_digest_placeholder" | string;
  /** Calendar / list grouping */
  category: CalendarCategory;
};

const DEFAULT_UNKNOWN: WorkflowTypeConfig = {
  label: "Appointment",
  department: "sales",
  stages: PIPELINE_STAGE_ORDER as unknown as string[],
  manualCompletion: true,
  blocksStageAdvance: false,
  dueHours: 48,
  slaHours: 48,
  showInCalendar: true,
  calendarColor: "slate",
  autoCancelOnStageBackward: true,
  recurrence: "none",
  category: "generic",
};

/**
 * Single source of truth keyed by `appointment_type_key` (and template keys like `tpl_*`).
 * Add new appointment types here first; DB seeds / imports should follow these slugs where possible.
 */
export const WORKFLOW_TYPES: Record<string, WorkflowTypeConfig> = {
  // ─── Service / welcome packet ─────────────────────────────────────────────────────
  packet_sent: {
    label: "Packet Sent",
    department: "service",
    stages: ["account_manager"],
    manualCompletion: false,
    blocksStageAdvance: false,
    dueHours: 24,
    slaHours: 24,
    showInCalendar: true,
    calendarColor: "orange",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },
  /** Template-generated title “Packet Sent” under account_manager — matches `templateReminderKey` */
  tpl_welcome_packet_packet_sent: {
    label: "Packet Sent",
    department: "service",
    stages: ["account_manager"],
    manualCompletion: false,
    blocksStageAdvance: false,
    dueHours: 2,
    slaHours: 4,
    showInCalendar: true,
    calendarColor: "orange",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },

  // ─── Sales modal types ────────────────────────────────────────────────────────────
  follow_up_appt_pre_auth: {
    label: "Follow Up Appointment (Pre-Auth)",
    department: "sales",
    stages: ["lead", "account_manager", "client_services"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "blue",
    autoCancelOnStageBackward: true,
    category: "sales_follow_up",
  },
  follow_up_appt_charge: {
    label: "Follow Up Appointment (Charge)",
    department: "sales",
    stages: ["lead", "account_manager", "client_services"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "blue",
    autoCancelOnStageBackward: true,
    category: "sales_follow_up",
  },
  follow_up_appt_decline: {
    label: "Follow Up Appointment (Decline)",
    department: "sales",
    stages: ["lead", "account_manager", "client_services"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "blue",
    autoCancelOnStageBackward: true,
    category: "sales_follow_up",
  },
  follow_up_attempt_pre_auth: {
    label: "Follow Up Attempt (Pre-Auth)",
    department: "sales",
    stages: ["lead", "account_manager", "client_services"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "blue",
    autoCancelOnStageBackward: true,
    category: "sales_follow_up",
  },
  follow_up_attempt_charge: {
    label: "Follow Up Attempt (Charge)",
    department: "sales",
    stages: ["lead", "account_manager", "client_services"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "blue",
    autoCancelOnStageBackward: true,
    category: "sales_follow_up",
  },
  appointment_set: {
    label: "Appointment Set",
    department: "sales",
    stages: ["lead", "account_manager", "client_services"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "emerald",
    autoCancelOnStageBackward: true,
    category: "sales_follow_up",
  },
  prospect_follow_up: {
    label: "Prospect Follow Up",
    department: "sales",
    stages: ["lead", "account_manager", "client_services"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "blue",
    autoCancelOnStageBackward: true,
    category: "sales_follow_up",
  },

  // ─── Service modal types ─────────────────────────────────────────────────────────
  follow_up_needed: {
    label: "Follow Up Needed",
    department: "service",
    stages: ["account_manager", "awaiting_collection_letter", "case_sent_to_attorneys"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "amber",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },
  follow_up_appt_service: {
    label: "Follow Up Appointment",
    department: "service",
    stages: ["account_manager", "client_services", "awaiting_collection_letter"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "amber",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },
  follow_up_attempt_service: {
    label: "Follow Up Attempt",
    department: "service",
    stages: ["account_manager", "awaiting_collection_letter"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "amber",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },
  active_follow_up: {
    label: "Active Follow Up",
    department: "service",
    stages: ["account_manager", "awaiting_collection_letter"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 168,
    slaHours: 168,
    showInCalendar: true,
    calendarColor: "amber",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },
  dead_mark_client: {
    label: "Dead",
    department: "sales",
    stages: ["lead", "account_manager", "client_services", "retention"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 0,
    slaHours: 0,
    showInCalendar: false,
    calendarColor: "zinc",
    autoCancelOnStageBackward: false,
    category: "generic",
  },

  // ─── Sidebar / quick-pick aliases (same keys as `workflow-keys` SIDEBAR_DESCRIPTION_ALIASES) ───
  cs_intro_call: {
    label: "CS Intro Call",
    department: "sales",
    stages: ["client_services"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 24,
    slaHours: 24,
    showInCalendar: true,
    calendarColor: "violet",
    autoCancelOnStageBackward: true,
    category: "sales_follow_up",
  },
  all_cards_charged: {
    label: "All Cards Charged",
    department: "sales",
    stages: ["lead", "account_manager"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 4,
    slaHours: 8,
    showInCalendar: true,
    calendarColor: "yellow",
    autoCancelOnStageBackward: true,
    category: "generic",
  },
  retention_call: {
    label: "Retention Call",
    department: "retention",
    stages: ["retention"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 24,
    slaHours: 24,
    showInCalendar: true,
    calendarColor: "teal",
    autoCancelOnStageBackward: true,
    category: "retention",
  },
  waiting_call_collection: {
    label: "Check-In Waiting Call",
    department: "service",
    stages: ["awaiting_collection_letter"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 72,
    showInCalendar: true,
    calendarColor: "red",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },
  sixty_day_call: {
    label: "60 Day Call",
    department: "service",
    stages: ["awaiting_collection_letter"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 1440,
    slaHours: 1440,
    showInCalendar: true,
    calendarColor: "amber",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },
  ninety_day_call: {
    label: "90 Day Call",
    department: "service",
    stages: ["awaiting_collection_letter"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 2160,
    slaHours: 2160,
    showInCalendar: true,
    calendarColor: "amber",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },
  case_sent_call: {
    label: "Case Sent Call",
    department: "legal",
    stages: ["case_sent_to_attorneys"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 4,
    slaHours: 8,
    showInCalendar: true,
    calendarColor: "green",
    autoCancelOnStageBackward: true,
    category: "legal_handoff",
  },
  dnc_confirmed: {
    label: "DNC Confirmed",
    department: "sales",
    stages: ["dnc"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 24,
    slaHours: 48,
    showInCalendar: false,
    calendarColor: "zinc",
    autoCancelOnStageBackward: false,
    category: "generic",
  },
  twenty_four_hr_call: {
    label: "24 HR Call",
    department: "sales",
    stages: ["lead", "account_manager", "client_services", "retention"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 24,
    slaHours: 24,
    showInCalendar: true,
    calendarColor: "blue",
    autoCancelOnStageBackward: true,
    category: "sales_follow_up",
  },
  forty_eight_hr_call: {
    label: "48 HR Call",
    department: "sales",
    stages: ["lead", "account_manager", "client_services", "retention"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 48,
    showInCalendar: true,
    calendarColor: "blue",
    autoCancelOnStageBackward: true,
    category: "sales_follow_up",
  },
  seven_day_call: {
    label: "AM Enrollment Follow-Up",
    department: "service",
    stages: ["account_manager", "awaiting_collection_letter"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 168,
    slaHours: 168,
    showInCalendar: true,
    calendarColor: "amber",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },
  thirty_day_call: {
    label: "30 Day Call",
    department: "service",
    stages: ["account_manager", "awaiting_collection_letter", "case_sent_to_attorneys"],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 720,
    slaHours: 720,
    showInCalendar: true,
    calendarColor: "amber",
    autoCancelOnStageBackward: true,
    category: "service_ops",
  },

  // ─── Imports / migration ─────────────────────────────────────────────────────────
  import_follow_up: {
    label: "Follow Up (imported)",
    department: "sales",
    stages: PIPELINE_STAGE_ORDER as unknown as string[],
    manualCompletion: true,
    blocksStageAdvance: false,
    dueHours: 48,
    slaHours: 72,
    showInCalendar: true,
    calendarColor: "slate",
    autoCancelOnStageBackward: true,
    category: "generic",
  },
};

// ─── Appointments UI: ordered keys → labels (single source for modal + grouped list) ───

/** Modal / section order — sales tab (must match historical `SALES_APPOINTMENT_TYPES` order). */
export const SALES_APPOINTMENT_KEYS_ORDERED = [
  "follow_up_appt_pre_auth",
  "follow_up_appt_charge",
  "follow_up_appt_decline",
  "follow_up_attempt_pre_auth",
  "follow_up_attempt_charge",
  "appointment_set",
  "prospect_follow_up",
] as const;

/** Modal / section order — service tab (must match historical `SERVICE_APPOINTMENT_TYPES` order). */
export const SERVICE_APPOINTMENT_KEYS_ORDERED = [
  "follow_up_needed",
  "follow_up_appt_service",
  "follow_up_attempt_service",
  "active_follow_up",
] as const;

/** Legacy Add Appointment: these keys require an explicit due date (not auto +48h). */
export const MANUAL_DUE_DATE_KEYS_ORDERED = ["active_follow_up"] as const;

export function getSalesAppointmentLabelsOrdered(): readonly string[] {
  return SALES_APPOINTMENT_KEYS_ORDERED.map((k) => WORKFLOW_TYPES[k].label);
}

export function getServiceAppointmentLabelsOrdered(): readonly string[] {
  return SERVICE_APPOINTMENT_KEYS_ORDERED.map((k) => WORKFLOW_TYPES[k].label);
}

/** Legacy `AUTO_48HR_TYPES`: all sales labels + service labels except manual-due keys. */
export function getAuto48HourDueLabels(): readonly string[] {
  const manual = new Set<string>(MANUAL_DUE_DATE_KEYS_ORDERED as unknown as string[]);
  const sales = SALES_APPOINTMENT_KEYS_ORDERED.map((k) => WORKFLOW_TYPES[k].label);
  const serviceAuto = SERVICE_APPOINTMENT_KEYS_ORDERED.filter((k) => !manual.has(k)).map(
    (k) => WORKFLOW_TYPES[k].label
  );
  return [...sales, ...serviceAuto];
}

/** Legacy `MANUAL_DATE_TYPES` — Active Follow Up only (Dead excluded from modal/list ordering). */
export function getManualDueDateLabels(): readonly string[] {
  return MANUAL_DUE_DATE_KEYS_ORDERED.map((k) => WORKFLOW_TYPES[k].label);
}

/**
 * Exact modal labels → `appointment_type_key` for creates and legacy resolution.
 * Sidebar/template aliases stay in `workflow-keys.ts` (extended map).
 */
export function buildModalAppointmentLabelToKey(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SALES_APPOINTMENT_KEYS_ORDERED) {
    out[WORKFLOW_TYPES[k].label] = k;
  }
  for (const k of SERVICE_APPOINTMENT_KEYS_ORDERED) {
    out[WORKFLOW_TYPES[k].label] = k;
  }
  return out;
}

// ─── Pipeline tab (sales vs service) — legacy `inferPipelineFromClientStage` ────────────

const SALES_PIPELINE_STAGES = new Set([
  "lead",
  "account_manager",
  "retention",
]);

const SERVICE_PIPELINE_STAGES = new Set([
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
  "mortgage",
]);

export type PipelineKind = "sales" | "service";

/**
 * Which Appointments tab / `pipeline_type` a client stage implies.
 * @legacy DNQ, closed, etc. default to `"sales"` when not listed above.
 */
export function inferPipelineFromClientStage(stage: string | null | undefined): PipelineKind {
  const s = (stage ?? "").trim();
  if (SALES_PIPELINE_STAGES.has(s)) return "sales";
  if (SERVICE_PIPELINE_STAGES.has(s)) return "service";
  return "sales";
}

// ─── Department by pipeline stage (queue routing) ────────────────────────────────────

const STAGE_DEFAULT_DEPARTMENT: Partial<Record<string, WorkflowDepartment>> = {
  lead: "sales",
  account_manager: "sales",
  retention: "retention",
  client_services: "service",
  awaiting_collection_letter: "service",
  case_sent_to_attorneys: "legal",
  dnc: "sales",
  closed: "sales",
};

/** Default operational department for a lifecycle stage (when reminder row has no department yet). */
export function getDepartmentFromStage(stage: string | null | undefined): WorkflowDepartment {
  const s = (stage ?? "").trim();
  return STAGE_DEFAULT_DEPARTMENT[s] ?? "sales";
}

// ─── Lookup & legacy inference ───────────────────────────────────────────────────────

export function getWorkflowType(key: string | null | undefined): WorkflowTypeConfig {
  if (!key) return DEFAULT_UNKNOWN;
  return WORKFLOW_TYPES[key] ?? DEFAULT_UNKNOWN;
}

/** Merge defaults so callers always get a full object (safe for calendar / SLA UI). */
export function getDefaultReminderConfig(key: string | null | undefined): WorkflowTypeConfig {
  const base = getWorkflowType(key);
  return { ...DEFAULT_UNKNOWN, ...base };
}

// ─── Automation hooks ────────────────────────────────────────────────────────────────

export function shouldAutoCompleteTask(
  key: string | null | undefined,
  event: AutoCompleteEvent
): boolean {
  const cfg = getWorkflowType(key);
  if (event.type === "manual") {
    return cfg.manualCompletion;
  }
  return false;
}

// ─── Stage progression (client-level gates; extend with config-driven blockers later) ─

export type StageAdvanceClient = {
  poa_signed_at?: string | null;
  hasPoaDocument?: boolean;
  hasCcAuthorization?: boolean;
};

/**
 * Whether the CRM allows advancing `fromStage` → `toStage` for this client (manual Advance button).
 * Automated triggers (document upload, e-sign completion) may still move stages separately.
 */
export function canAdvanceStage(
  fromStage: string,
  toStage: string,
  client: StageAdvanceClient
): { ok: boolean; reason?: string } {
  const poa = blockAdvanceFromClientServicesWithoutPoa({
    fromStage,
    toStage,
    poaSignedAt: client.poa_signed_at,
    hasPoaDocument: client.hasPoaDocument,
  });
  if (poa.blocked) return { ok: false, reason: poa.reason };

  const ccAuth = blockAdvanceFromAccountManagerWithoutCcAuth({
    fromStage,
    toStage,
    hasCcAuthorization: client.hasCcAuthorization,
  });
  if (ccAuth.blocked) {
    return { ok: false, reason: ccAuth.reason };
  }

  // Future: scan open reminders with blocksStageAdvance for this client (requires query layer).
  return { ok: true };
}

/** Whether config suggests auto-cancel when moving backward (orchestration may already handle). */
export function shouldAutoCancelOnBackward(key: string | null | undefined): boolean {
  return getWorkflowType(key).autoCancelOnStageBackward;
}

