/**
 * Centralized reminder/workflow orchestration.
 * All mutation paths should converge here over time; legacy direct writes remain until migrated.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PIPELINE_STAGE_ORDER } from "@/lib/constants/stages";
import {
  inferPipelineFromClientStage,
  type WorkflowDepartment,
} from "@/lib/reminders/workflow-config";
import {
  inferDepartment,
  resolveAppointmentTypeKey,
  templateReminderKey,
} from "@/lib/reminders/workflow-keys";

export type WorkflowSource =
  | "manual"
  | "template"
  | "import"
  | "migration"
  | "system";

export type CreateWorkflowTaskInput = {
  client_id: string;
  /** Legacy display / grouping — unchanged for compatibility */
  description: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  /** Current pipeline stage on the client — drives department + pipeline_type dual-write */
  client_stage: string | null;
  appointment_type?: string | null;
  appointment_type_key?: string | null;
  pipeline_type?: "sales" | "service" | null;
  department?: WorkflowDepartment | null;
  auto_generated?: boolean;
  from_template_id?: string | null;
  origin_stage?: string | null;
  workflow_source?: WorkflowSource;
  /** Optional staff notes (manual appointments) */
  notes?: string | null;
};

function stageOrderIndex(stage: string): number {
  return PIPELINE_STAGE_ORDER.indexOf(stage as (typeof PIPELINE_STAGE_ORDER)[number]);
}

export function buildReminderInsertRow(input: CreateWorkflowTaskInput): Record<string, unknown> {
  const pipeline =
    input.pipeline_type ?? inferPipelineFromClientStage(input.client_stage ?? null);

  const dept =
    input.department ??
    inferDepartment({
      clientStage: input.client_stage,
      pipelineType: pipeline,
    });

  const key =
    input.appointment_type_key ??
    resolveAppointmentTypeKey({
      appointment_type: input.appointment_type,
      description: input.description,
    });

  const row: Record<string, unknown> = {
    client_id: input.client_id,
    description: input.description,
    due_date: input.due_date,
    assigned_to: input.assigned_to,
    created_by: input.created_by,
    completed: false,
    cancelled: false,
    auto_generated: input.auto_generated ?? false,
    pipeline_type: pipeline,
  };

  if (input.from_template_id) row.from_template_id = input.from_template_id;
  // origin_stage / workflow_source / appointment_type_key omitted: columns not yet present in
  // production DB (migration 20260506150000_workflow_reminders_phase1.sql not applied)
  const at = input.appointment_type?.trim();
  if (at) row.appointment_type = at;
  if (input.notes != null && String(input.notes).trim()) {
    row.notes = String(input.notes).trim();
  }

  return row;
}

export async function createWorkflowTask(
  supabase: SupabaseClient,
  input: CreateWorkflowTaskInput
): Promise<{ error: Error | null; id?: string }> {
  const row = buildReminderInsertRow(input);
  const { data, error } = await supabase
    .from("reminders")
    .insert(row)
    .select("id")
    .single();
  return {
    error: error ? new Error(error.message) : null,
    id: (data?.id as string | undefined) ?? undefined,
  };
}

export async function completeWorkflowTask(
  supabase: SupabaseClient,
  reminderId: string,
  options?: { clientId?: string }
): Promise<{ error: Error | null }> {
  let q = supabase
    .from("reminders")
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq("id", reminderId.trim())
    .eq("completed", false);

  if (options?.clientId) {
    q = q.eq("client_id", options.clientId);
  }

  const { error } = await q;

  return { error: error ? new Error(error.message) : null };
}

export async function cancelWorkflowTask(
  supabase: SupabaseClient,
  reminderId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("reminders")
    .update({ cancelled: true })
    .eq("id", reminderId.trim())
    .eq("completed", false)
    .eq("cancelled", false);

  return { error: error ? new Error(error.message) : null };
}

/**
 * After clients.stage is persisted:
 * - advance: complete open template tasks tied to the stage we left (+ origin_stage matches)
 * - back: soft-cancel open tasks tied to pipeline stages ahead of the new stage
 */
export async function handleStageTransition(
  supabase: SupabaseClient,
  args: {
    clientId: string;
    oldStage: string;
    newStage: string;
    mode: "advance" | "back";
  }
): Promise<{ error: Error | null }> {
  const { clientId, oldStage, newStage, mode } = args;
  const now = new Date().toISOString();

  try {
    if (mode === "advance") {
      const { data: tplRows, error: tErr } = await supabase
        .from("reminder_templates")
        .select("id")
        .eq("stage", oldStage)
        .eq("is_active", true);

      if (tErr) return { error: new Error(tErr.message) };

      const ids = (tplRows ?? []).map((r) => r.id as string).filter(Boolean);

      if (ids.length > 0) {
        const { error: u1 } = await supabase
          .from("reminders")
          .update({ completed: true, completed_at: now })
          .eq("client_id", clientId)
          .eq("completed", false)
          .eq("cancelled", false)
          .in("from_template_id", ids);

        if (u1) return { error: new Error(u1.message) };
      }

      // origin_stage filter omitted: column not in production DB (same migration gap as above)
    } else {
      const newIdx = stageOrderIndex(newStage);
      if (newIdx < 0) return { error: null };

      for (let i = newIdx + 1; i < PIPELINE_STAGE_ORDER.length; i++) {
        const aheadStage = PIPELINE_STAGE_ORDER[i];

        const { data: tplAhead, error: taErr } = await supabase
          .from("reminder_templates")
          .select("id")
          .eq("stage", aheadStage)
          .eq("is_active", true);

        if (taErr) return { error: new Error(taErr.message) };

        const aheadIds = (tplAhead ?? []).map((r) => r.id as string).filter(Boolean);

        if (aheadIds.length > 0) {
          const { error: c1 } = await supabase
            .from("reminders")
            .update({ cancelled: true })
            .eq("client_id", clientId)
            .eq("completed", false)
            .eq("cancelled", false)
            .in("from_template_id", aheadIds);

          if (c1) return { error: new Error(c1.message) };
        }

        // origin_stage filter omitted: column not in production DB (same migration gap as above)
      }
    }

    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** Used when inserting rows from reminder_templates (stage advance). */
export function rowFromTemplate(opts: {
  clientId: string;
  assignedTo: string | null;
  templateId: string;
  templateStage: string;
  title: string;
  descriptionFallback: string;
  dueIso: string;
}): Record<string, unknown> {
  const reminderText =
    typeof opts.title === "string" && opts.title.trim()
      ? opts.title.trim()
      : opts.descriptionFallback.trim();

  const appointment_type_key = templateReminderKey(opts.templateStage, reminderText);

  return buildReminderInsertRow({
    client_id: opts.clientId,
    description: reminderText,
    due_date: opts.dueIso,
    assigned_to: opts.assignedTo,
    created_by: null,
    client_stage: opts.templateStage,
    appointment_type_key,
    auto_generated: true,
    from_template_id: opts.templateId,
    origin_stage: opts.templateStage,
    workflow_source: "template",
  });
}
