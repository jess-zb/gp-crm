import { PIPELINE_PAGE_STAGES } from "@/lib/crm/pipeline-stage-counts";

/** @deprecated Use PIPELINE_PAGE_STAGES — kept for any legacy imports. */
export const PIPELINE_VIEW_SALES_STAGES = [
  "lead",
  "account_manager",
  "retention",
  "not_interested",
  "dnq",
  "dnc",
  "mortgage",
] as const;

/** @deprecated Use PIPELINE_PAGE_STAGES — kept for any legacy imports. */
export const PIPELINE_VIEW_SERVICE_STAGES = [
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
  "dnc",
  "closed",
] as const;

/** Stages fetched for the redesigned Pipeline page (active clients). */
export const PIPELINE_VIEW_FETCH_STAGES: string[] = [...PIPELINE_PAGE_STAGES];
