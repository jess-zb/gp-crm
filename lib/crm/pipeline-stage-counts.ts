/** Stages shown on the redesigned Pipeline page (active clients only). */
export const PIPELINE_PAGE_STAGES = [
  "lead",
  "welcome_packet",
  "retention",
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
] as const;

export type PipelinePageStage = (typeof PIPELINE_PAGE_STAGES)[number];

export function emptyPipelineStageCounts(): Record<PipelinePageStage, number> {
  return {
    lead: 0,
    welcome_packet: 0,
    retention: 0,
    client_services: 0,
    awaiting_collection_letter: 0,
    case_sent_to_attorneys: 0,
  };
}

/** Count active clients per pipeline tab stage (ignores unknown stages). */
export function aggregatePipelinePageCounts(
  rows: { stage: string; is_active?: boolean | null }[]
): Record<PipelinePageStage, number> {
  const out = emptyPipelineStageCounts();
  for (const r of rows) {
    if (r.is_active === false) continue;
    const s = r.stage as PipelinePageStage;
    if (s in out) out[s] += 1;
  }
  return out;
}

export function salesPipelineTabTotal(counts: Record<PipelinePageStage, number>): number {
  return counts.lead + counts.welcome_packet + counts.retention;
}

export function servicePipelineTabTotal(counts: Record<PipelinePageStage, number>): number {
  return (
    counts.client_services +
    counts.awaiting_collection_letter +
    counts.case_sent_to_attorneys
  );
}

export function totalPipelineNavBadge(counts: Record<PipelinePageStage, number>): number {
  return salesPipelineTabTotal(counts) + servicePipelineTabTotal(counts);
}

/** Dashboard / analytics: broader stage set (active rows only). */
export type DashboardStageCountKey =
  | "lead"
  | "compliance_verification"
  | "welcome_packet"
  | "client_services"
  | "awaiting_collection_letter"
  | "case_sent_to_attorneys"
  | "retention"
  | "dnc"
  | "not_interested"
  | "dnq"
  | "mortgage";

export function emptyDashboardStageCounts(): Record<DashboardStageCountKey, number> {
  return {
    lead: 0,
    compliance_verification: 0,
    welcome_packet: 0,
    client_services: 0,
    awaiting_collection_letter: 0,
    case_sent_to_attorneys: 0,
    retention: 0,
    dnc: 0,
    not_interested: 0,
    dnq: 0,
    mortgage: 0,
  };
}

export function aggregateDashboardStageCounts(
  rows: { stage: string; is_active: boolean | null }[]
): Record<DashboardStageCountKey, number> {
  const out = emptyDashboardStageCounts();
  for (const r of rows) {
    if (r.is_active !== true) continue;
    const s = r.stage as DashboardStageCountKey;
    if (s in out) out[s] += 1;
  }
  return out;
}

export function dashboardSalesActive(counts: Record<DashboardStageCountKey, number>): number {
  return counts.lead + counts.welcome_packet + counts.retention;
}

export function dashboardServiceActive(counts: Record<DashboardStageCountKey, number>): number {
  return (
    counts.client_services +
    counts.awaiting_collection_letter +
    counts.case_sent_to_attorneys
  );
}
