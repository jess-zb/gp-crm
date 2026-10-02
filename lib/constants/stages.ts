/**
 * Single source of truth for CRM pipeline stages: order, labels, and colors.
 */

/** Active happy-path + Retention (Cancel) order. */
export const PIPELINE_STAGE_ORDER = [
  "lead",
  "welcome_packet",
  "retention",
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGE_ORDER)[number];

/**
 * Stages kept in DB/labels but hidden from pipeline tabs, funnels, and stage
 * pickers. Empty today — the hook stays so a stage can be retired without
 * rewriting every picker.
 */
export const HIDDEN_PIPELINE_STAGES: readonly string[] = [];

const HIDDEN_PIPELINE_STAGE_SET = new Set<string>(HIDDEN_PIPELINE_STAGES);

export function isPipelineStageHidden(stage: string | null | undefined): boolean {
  return HIDDEN_PIPELINE_STAGE_SET.has((stage ?? "").trim());
}

export const STAGE_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    dot: string;
    border: string;
    hex: string;
  }
> = {
  lead: {
    label: "New Lead",
    color: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
    border: "border-blue-200",
    hex: "#3B82F6",
  },
  welcome_packet: {
    label: "Account Manager",
    color: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    border: "border-amber-200",
    hex: "#F59E0B",
  },
  client_services: {
    label: "Client Services",
    color: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
    hex: "#10B981",
  },
  retention: {
    label: "Retention",
    color: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
    border: "border-orange-200",
    hex: "#F97316",
  },
  awaiting_collection_letter: {
    label: "Awaiting Collections",
    color: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-500",
    border: "border-indigo-200",
    hex: "#6366F1",
  },
  case_sent_to_attorneys: {
    label: "Case Sent to Attorneys",
    color: "bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
    border: "border-slate-200",
    hex: "#475569",
  },
  dnc: {
    label: "DNC",
    color: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    border: "border-red-200",
    hex: "#EF4444",
  },
  not_interested: {
    label: "Not Interested",
    color: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
    border: "border-gray-200",
    hex: "#9CA3AF",
  },
  dnq: {
    label: "DNQ",
    color: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
    border: "border-gray-200",
    hex: "#9CA3AF",
  },
  mortgage: {
    label: "Mortgage",
    color: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
    border: "border-gray-200",
    hex: "#9CA3AF",
  },
  closed: {
    label: "Closed / Archived",
    color: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
    border: "border-gray-200",
    hex: "#9CA3AF",
  },
};

const FALLBACK_STAGE = {
  label: "",
  color: "bg-gray-100 text-gray-600",
  dot: "bg-gray-400",
  border: "border-gray-200",
  hex: "#9CA3AF",
};

/** Full CRM order including terminal stages (for audit + reporting). */
export const ALL_STAGE_ORDER = [
  "lead",
  "welcome_packet",
  "retention",
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
  "dnc",
  "not_interested",
  "dnq",
  "mortgage",
  "closed",
] as const;

export type AllStageKey = (typeof ALL_STAGE_ORDER)[number];

const ALL_STAGE_SET = new Set<string>(ALL_STAGE_ORDER as readonly string[]);

/** Dashboard / pipeline breakdown row order (active pipeline only). */
export const DASHBOARD_PIPELINE_ROWS = PIPELINE_STAGE_ORDER;

export function getStageConfig(stage: string) {
  const c = STAGE_CONFIG[stage];
  if (c) return c;
  return {
    ...FALLBACK_STAGE,
    label: stage,
  };
}

/** Tailwind classes for a bordered stage pill (no dot). */
export function getStagePillClass(stage: string): string {
  const c = getStageConfig(stage);
  return `${c.color} ${c.border} px-2.5 py-0.5 rounded-full text-xs font-medium border`;
}

export const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_CONFIG).map(([k, v]) => [k, v.label])
);

/** @deprecated Prefer `getStageConfig` / `STAGE_CONFIG` — bar/dot class for charts. */
export const DASHBOARD_PIPELINE_COLORS: Record<string, string> = Object.fromEntries(
  Object.keys(STAGE_CONFIG).map((k) => [k, getStageConfig(k).dot])
);

/** @deprecated Prefer `StagePill` or `getStagePillClass`. */
export const STAGE_COLORS: Record<string, string> = Object.fromEntries(
  Object.keys(STAGE_CONFIG).map((k) => {
    const c = getStageConfig(k);
    return [k, `${c.color} ${c.border}`];
  })
);

export function getStageLabel(stage: string): string {
  return getStageConfig(stage).label;
}

export function getStageColor(stage: string): string {
  return STAGE_COLORS[stage] ?? STAGE_COLORS.closed ?? "bg-gray-100 text-gray-600 border-gray-200";
}

export function normalizeStageKey(raw: string | null | undefined): string {
  const s = raw?.trim() ?? "";
  if (s && ALL_STAGE_SET.has(s)) return s;
  return "lead";
}
