import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorkflowTask } from "@/lib/reminders/workflow";
import {
  cancelActiveSequenceEnrollments,
  cancelSequencesByKeys,
  enrollClientInEmailSequence,
  reactivateOrEnrollSequence,
} from "@/lib/email/sequence-enrollment";
import { runCaseSentToAttorneysTriggers } from "@/lib/clients/case-sent-triggers";
import { ensureCsChecklistItems } from "@/lib/clients/cs-checklist";

function addDaysIso(from: Date, days: number): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function addHoursIso(from: Date, hours: number): string {
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

/**
 * Open appointment types cancelled when the client leaves this stage.
 * Includes types we no longer auto-create so leftover open rows still clear.
 * Template-sourced rows are completed/cancelled via `from_template_id` instead.
 */
export const STAGE_APPOINTMENT_TYPES: Record<string, string[]> = {
  lead: [],
  welcome_packet: [],
  client_services: ["cs_intro_call", "poa_follow_up_call"],
  awaiting_collection_letter: [
    "check_in_30_day",
    "check_in_60_day",
    "check_in_90_day",
  ],
  retention: ["retention_call"],
  case_sent_to_attorneys: ["case_sent_notification"],
};

/**
 * Auto-create on stage entry. Flip a flag back to true to resume — types stay
 * available in the add-appointment UI for manual use.
 */
const AUTO_CREATE = {
  csIntroCall: true,
  retentionCall: false,
  collectionLetterCheckIns: false,
} as const;

export async function cancelOpenAppointmentsForStage(
  supabase: SupabaseClient,
  clientId: string,
  previousStage: string
): Promise<void> {
  const typesToCancel = STAGE_APPOINTMENT_TYPES[previousStage] ?? [];
  if (typesToCancel.length === 0) return;

  const { error } = await supabase
    .from("reminders")
    .update({ cancelled: true })
    .eq("client_id", clientId)
    .eq("completed", false)
    .eq("cancelled", false)
    .in("appointment_type", typesToCancel);

  if (error) {
    console.warn("[cancelStageAppointments]", previousStage, error.message);
  }
}

async function insertReminderIfMissing(
  supabase: SupabaseClient,
  args: {
    clientId: string;
    assignedTo: string | null;
    performerId: string | null;
    appointmentType: string;
    description: string;
    dueIso: string;
    pipeline: "sales" | "service";
    clientStage: string;
  }
): Promise<void> {
  const { count } = await supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("client_id", args.clientId)
    .eq("appointment_type", args.appointmentType)
    .eq("completed", false)
    .eq("cancelled", false);

  if ((count ?? 0) > 0) return;

  await createWorkflowTask(supabase, {
    client_id: args.clientId,
    description: args.description,
    due_date: args.dueIso,
    assigned_to: args.assignedTo,
    created_by: args.performerId,
    client_stage: args.clientStage,
    appointment_type: args.appointmentType,
    pipeline_type: args.pipeline,
    workflow_source: "system",
  });
}

const TERMINAL_SEQUENCE_STAGES = new Set(["dnc", "closed", "not_interested"]);

export type StageEntrySideEffectsArgs = {
  clientId: string;
  oldStage: string;
  newStage: string;
  assignedTo: string | null;
  performerId: string | null;
  /** When false, skip reminder + positive enrollments (still cancels on terminal). */
  forward: boolean;
};

/**
 * After a successful pipeline change: cancel drips on terminal stages; on forward entry,
 * create stage-specific appointments / sequence enrollments.
 */
export async function runStageEntrySideEffects(
  supabase: SupabaseClient,
  args: StageEntrySideEffectsArgs
): Promise<void> {
  const { clientId, oldStage, newStage, assignedTo, performerId, forward } = args;
  const now = new Date();

  if (forward && oldStage !== newStage) {
    await cancelOpenAppointmentsForStage(supabase, clientId, oldStage);
  }

  if (TERMINAL_SEQUENCE_STAGES.has(newStage)) {
    await cancelActiveSequenceEnrollments(supabase, clientId);
    return;
  }

  // Account Manager (welcome_packet) — nudge-to-enroll drip
  if (newStage === "welcome_packet") {
    await enrollClientInEmailSequence(supabase, {
      clientId,
      sequenceKey: "partial_arc",
    });
  }

  if (newStage === "client_services") {
    // Gives the client a full row set on the Priority board immediately, rather
    // than waiting for the first tick to create rows.
    await ensureCsChecklistItems(supabase, clientId);

    // Client fully enrolled — stop the partial_arc nudge drip
    await cancelSequencesByKeys(supabase, clientId, ["partial_arc"], "client_converted");
    await enrollClientInEmailSequence(supabase, {
      clientId,
      sequenceKey: "welcome_cs",
    });
    await enrollClientInEmailSequence(supabase, {
      clientId,
      sequenceKey: "active_arc",
    });
  }

  if (!forward) {
    return;
  }

  if (newStage === "client_services" && AUTO_CREATE.csIntroCall) {
    await insertReminderIfMissing(supabase, {
      clientId,
      assignedTo,
      performerId,
      appointmentType: "cs_intro_call",
      description: "CS Intro Call",
      dueIso: addHoursIso(now, 48),
      pipeline: "service",
      clientStage: "client_services",
    });
  }

  if (newStage === "retention" && AUTO_CREATE.retentionCall) {
    await insertReminderIfMissing(supabase, {
      clientId,
      assignedTo,
      performerId,
      appointmentType: "retention_call",
      description: "Retention Call",
      dueIso: addHoursIso(now, 24),
      pipeline: "service",
      clientStage: "retention",
    });
  }

  if (newStage === "awaiting_collection_letter") {
    // Resume active_arc from exactly where it left off if this client was pushed
    // back from case_sent_to_attorneys (user error). No-op if arc is still running.
    // Falls back to a fresh enrollment if no prior arc exists.
    await reactivateOrEnrollSequence(supabase, {
      clientId,
      sequenceKey: "active_arc",
      cancelReason: "case_sent_to_attorneys",
    });

    if (AUTO_CREATE.collectionLetterCheckIns) {
      const checkIns = [
        { days: 30, value: "check_in_30_day", label: "30-Day Check-In Call" },
        { days: 60, value: "check_in_60_day", label: "60-Day Check-In Call" },
        { days: 90, value: "check_in_90_day", label: "90-Day Check-In Call" },
      ] as const;
      for (const c of checkIns) {
        await insertReminderIfMissing(supabase, {
          clientId,
          assignedTo,
          performerId,
          appointmentType: c.value,
          description: c.label,
          dueIso: addDaysIso(now, c.days),
          pipeline: "service",
          clientStage: "awaiting_collection_letter",
        });
      }
    }
  }

  if (newStage === "case_sent_to_attorneys") {
    // Active Arc ends here — cancel ongoing client drips.
    // case_referred (client email) is enrolled only when staff assigns from
    // Attorney Queue — not on stage entry. The CS notify appointment is off;
    // this call still runs the (already-disabled) legacy attorney-email path.
    await cancelSequencesByKeys(
      supabase,
      clientId,
      ["active_arc", "welcome_cs", "partial_arc"],
      "case_sent_to_attorneys"
    );

    await runCaseSentToAttorneysTriggers({
      clientId,
      performerId,
      source: "stage_change",
    });
  }
}
