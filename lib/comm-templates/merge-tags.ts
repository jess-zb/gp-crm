import { STAGE_LABELS } from "@/lib/constants/stages";

/** Plain-English labels for case stages (merge tag {{stage}}). */
export const STAGE_LABEL_PLAIN = STAGE_LABELS;

export type TemplateMergeContext = {
  clientName: string;
  firstName: string;
  assignedUser: string;
  stageKey: string;
};

/** Replace merge tags in template subject/body with client-specific values. */
export function applyMergeTags(
  text: string | null | undefined,
  ctx: TemplateMergeContext
): string {
  const s = text ?? "";
  const stage = STAGE_LABELS[ctx.stageKey] ?? ctx.stageKey.replace(/_/g, " ");
  return s
    .replace(/\{\{client_name\}\}/g, ctx.clientName)
    .replace(/\{\{first_name\}\}/g, ctx.firstName)
    .replace(/\{\{assigned_user\}\}/g, ctx.assignedUser)
    .replace(/\{\{stage\}\}/g, stage);
}
