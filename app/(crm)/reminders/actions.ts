"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import {
  completeWorkflowTask,
  createWorkflowTask,
} from "@/lib/reminders/workflow";
import { enrollmentDueAtIso } from "@/lib/email/sequence-schedule";
import { toUserFacingError } from "@/lib/user-facing-error";

export type ReminderActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type AppointmentModalResult =
  | {
      ok: true;
      newReminder: {
        id: string;
        description: string;
        due_date: string | null;
        completed: boolean;
        cancelled: boolean;
        completed_at: string | null;
        assigned_to: string | null;
        appointment_type: string | null;
        notes: string | null;
      };
    }
  | { ok: false; error: string };

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error: profErr } = await getProfileForUser(supabase, user);
  if (profErr || !profile) {
    if (profErr) console.error("[reminders/actions] profile error:", profErr);
    redirect("/login");
  }
  if (profile.role === "client") redirect("/portal");

  return { supabase, user, profile };
}

export async function completeReminder(reminderId: string): Promise<ReminderActionResult> {
  const id = reminderId.trim();
  if (!id) return { ok: false, error: "Missing appointment." };

  try {
    const { supabase } = await requireStaff();
    const { error } = await completeWorkflowTask(supabase, id);
    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath("/reminders");
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    console.error("[reminders/actions] completeReminder error:", message);
    return { ok: false, error: message };
  }
}

export async function updateAppointment(input: {
  id: string;
  appointment_type: string;
  description: string;
  due_date_iso: string;
  assigned_to: string | null;
  notes: string | null;
  client_id: string | null;
}): Promise<ReminderActionResult> {
  const id = input.id.trim();
  if (!id) return { ok: false, error: "Missing appointment." };
  const appointmentType = input.appointment_type.trim();
  if (!appointmentType) return { ok: false, error: "Select an appointment type." };

  try {
    const { supabase } = await requireStaff();
    const { error } = await supabase
      .from("reminders")
      .update({
        appointment_type: appointmentType,
        description: input.description.trim() || appointmentType,
        due_date: input.due_date_iso,
        assigned_to: input.assigned_to,
        notes: input.notes,
      })
      .eq("id", id);

    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath("/reminders");
    if (input.client_id) revalidatePath(`/clients/${input.client_id}`);
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    console.error("[reminders/actions] updateAppointment error:", message);
    return { ok: false, error: message };
  }
}

export async function deleteReminder(reminderId: string): Promise<ReminderActionResult> {
  const id = reminderId.trim();
  if (!id) return { ok: false, error: "Missing appointment." };

  try {
    const { supabase } = await requireStaff();
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (error) return { ok: false, error: toUserFacingError(error.message) };
    revalidatePath("/reminders");
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    console.error("[reminders/actions] deleteReminder error:", message);
    return { ok: false, error: message };
  }
}

export async function createReminder(formData: FormData): Promise<ReminderActionResult> {
  try {
    const clientId = String(formData.get("client_id") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const dueRaw = String(formData.get("due_date") ?? "").trim();
    const assignedTo = String(formData.get("assigned_to") ?? "").trim();
    const appointmentType = String(formData.get("appointment_type") ?? "").trim();
    const pipelineType = String(formData.get("pipeline_type") ?? "").trim();

    if (!clientId) return { ok: false, error: "Select a client." };
    if (!description) return { ok: false, error: "Appointment details are required." };

    const { supabase, user, profile } = await requireStaff();
    const performerName = profile.full_name?.trim() || user.email || "Staff";

    const due_date = dueRaw
      ? new Date(`${dueRaw}T12:00:00.000Z`).toISOString()
      : null;

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("stage")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr) {
      console.error("[reminders/actions] createReminder client fetch error:", clientErr.message);
      return { ok: false, error: "Failed to fetch client information" };
    }

    const clientRowTyped = clientRow as { stage: string | null } | null;
    const client_stage = clientRowTyped?.stage ?? null;

    const { error } = await createWorkflowTask(supabase, {
      client_id: clientId,
      description,
      due_date,
      assigned_to: assignedTo || null,
      created_by: user.id,
      client_stage,
      appointment_type: appointmentType || null,
      pipeline_type:
        pipelineType === "sales" || pipelineType === "service"
          ? pipelineType
          : null,
      workflow_source: "manual",
    });

    if (error) return { ok: false, error: toUserFacingError(error.message) };

    const { error: auditErr } = await supabase.from("audit_log").insert({
      client_id: clientId,
      action: "appointment_created",
      new_value: {
        description,
        due_date,
        appointment_type: appointmentType || null,
      },
      performed_by: user.id,
      performed_by_name: performerName,
    });
    if (auditErr) {
      console.warn("[createReminder] audit_log:", auditErr.message);
    }

    revalidatePath("/reminders");
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[reminders/actions] createReminder unexpected error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function createAppointmentFromModal(input: {
  client_id: string;
  appointment_type: string;
  description: string;
  due_date_iso: string;
  assigned_to: string | null;
  notes: string | null;
  pipeline_type: "sales" | "service";
}): Promise<AppointmentModalResult> {
  try {
    const clientId = input.client_id.trim();
    if (!clientId) return { ok: false, error: "Select a client." };
    const appointmentType = input.appointment_type.trim();
    if (!appointmentType) return { ok: false, error: "Select an appointment type." };
    const description = input.description.trim();
    if (!description) return { ok: false, error: "Appointment label required." };

    const { supabase, user, profile } = await requireStaff();
    const performerName = profile.full_name?.trim() || user.email || "Staff";

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("stage")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr) {
      console.error("[reminders/actions] createAppointmentFromModal client fetch error:", clientErr.message);
      return { ok: false, error: "Failed to fetch client information" };
    }

    const clientRowTyped = clientRow as { stage: string | null } | null;
    const client_stage = clientRowTyped?.stage ?? null;

    const { error, id: reminderId } = await createWorkflowTask(supabase, {
      client_id: clientId,
      description,
      due_date: input.due_date_iso,
      assigned_to: input.assigned_to?.trim() || user.id,
      created_by: user.id,
      client_stage,
      appointment_type: appointmentType,
      pipeline_type: input.pipeline_type,
      workflow_source: "manual",
      notes: input.notes?.trim() || null,
    });

    if (error) return { ok: false, error: toUserFacingError(error.message) };
    if (!reminderId) {
      return { ok: false, error: "Appointment saved but id was not returned." };
    }

    const { error: auditErr } = await supabase.from("audit_log").insert({
      client_id: clientId,
      action: "appointment_created",
      new_value: {
        description,
        due_date: input.due_date_iso,
        appointment_type: appointmentType,
      },
      performed_by: user.id,
      performed_by_name: performerName,
    });
    if (auditErr) {
      console.warn("[createAppointmentFromModal] audit_log:", auditErr.message);
    }

    revalidatePath("/reminders");
    revalidatePath(`/clients/${clientId}`);
    return {
      ok: true,
      newReminder: {
        id: reminderId,
        description,
        due_date: input.due_date_iso,
        completed: false,
        cancelled: false,
        completed_at: null,
        assigned_to: input.assigned_to?.trim() || user.id,
        appointment_type: appointmentType,
        notes: input.notes?.trim() || null,
      },
    };
  } catch (err) {
    console.error("[reminders/actions] createAppointmentFromModal error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function markClientDeadFromAppointment({
  clientId,
}: {
  clientId: string;
}): Promise<ReminderActionResult> {
  const id = clientId.trim();
  if (!id) return { ok: false, error: "Missing client." };

  try {
    const { supabase, user, profile } = await requireStaff();
    const performerName = profile.full_name?.trim() || user.email || "Staff";

    // Setting is_active=false fires the DB trigger
    // `cancel_enrollments_on_client_inactive`, which cancels every active
    // email enrollment. Do NOT rely on any app-side cancel here.
    const { error: uerr } = await supabase
      .from("clients")
      .update({
        stage: "dnc",
        is_active: false,
        dnc_reason: "dead",
        stage_entered_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (uerr) return { ok: false, error: toUserFacingError(uerr.message) };

    const { error: aerr } = await supabase.from("audit_log").insert({
      client_id: id,
      action: "stage_auto_advanced",
      new_value: { stage: "dnc", dnc_reason: "dead", trigger: "dead_appointment" },
      performed_by: user.id,
      performed_by_name: performerName,
    });
    if (aerr) {
      console.error("[reminders/actions] markClientDead audit error:", aerr.message);
      return { ok: false, error: toUserFacingError(aerr.message) };
    }

    const { error: cerr } = await supabase.from("cancellation_logs").insert({
      client_id: id,
      reason: "dead",
      notes: "Moved to DNC via Dead appointment type",
      performed_by: user.id,
      performed_by_name: performerName,
    });
    if (cerr) {
      console.error("[reminders/actions] markClientDead cancel log error:", cerr.message);
      return { ok: false, error: toUserFacingError(cerr.message) };
    }

    revalidatePath("/reminders");
    revalidatePath(`/clients/${id}`);
    return { ok: true };
  } catch (err) {
    console.error("[reminders/actions] markClientDead unexpected error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}

export type SequenceEnrollResult =
  | { ok: true }
  | { ok: false; error: string; needsSelection?: boolean };

export async function ensureActiveSequenceEnrollment(opts: {
  clientId: string;
  sequenceId?: string;
}): Promise<SequenceEnrollResult> {
  const clientId = opts.clientId.trim();
  if (!clientId) return { ok: false, error: "Missing client." };

  try {
    const { supabase } = await requireStaff();

    const { data: rows, error: rowsErr } = await supabase
      .from("sequence_enrollments")
      .select("id, status")
      .eq("client_id", clientId);

    if (rowsErr) {
      console.error("[reminders/actions] check enrollments error:", rowsErr.message);
      return { ok: false, error: "Failed to check existing enrollments" };
    }

    const typedRows = rows as { id: string; status: string }[] | null;
    const active = typedRows?.some((r) => r.status === "active");
    if (active) {
      return { ok: true };
    }

    if (typedRows && typedRows.length > 0) {
      const { data: toFix, error: selErr } = await supabase
        .from("sequence_enrollments")
        .select("id, enrolled_at, last_step_sent, sequence_id")
        .eq("client_id", clientId);
      if (selErr) return { ok: false, error: toUserFacingError(selErr.message) };

      const typedToFix = toFix as {
        id: string;
        enrolled_at: string;
        last_step_sent: number | null;
        sequence_id: string;
      }[] | null;

      for (const enr of typedToFix ?? []) {
        const nextOrder = (enr.last_step_sent ?? 0) + 1;
        const { data: st, error: stErr } = await supabase
          .from("email_sequence_steps")
          .select("day_offset")
          .eq("sequence_id", enr.sequence_id)
          .eq("step_order", nextOrder)
          .maybeSingle();
        if (stErr) {
          console.error("[reminders/actions] step fetch error:", stErr.message);
          return { ok: false, error: "Failed to fetch sequence steps" };
        }

        const typedSt = st as { day_offset: number } | null;
        const nextSend = typedSt
          ? enrollmentDueAtIso(String(enr.enrolled_at), Number(typedSt.day_offset))
          : new Date().toISOString();
        const { error } = await supabase
          .from("sequence_enrollments")
          .update({ status: "active", paused_at: null, next_send_at: nextSend })
          .eq("id", enr.id);
        if (error) return { ok: false, error: toUserFacingError(error.message) };
      }
      return { ok: true };
    }

    if (!opts.sequenceId?.trim()) {
      return { ok: false, needsSelection: true, error: "Select a drip campaign." };
    }

    const enrolledAt = new Date().toISOString();
    const seqId = opts.sequenceId.trim();
    const { data: firstStep, error: fsErr } = await supabase
      .from("email_sequence_steps")
      .select("day_offset")
      .eq("sequence_id", seqId)
      .order("step_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fsErr) {
      console.error("[reminders/actions] first step fetch error:", fsErr.message);
      return { ok: false, error: "Failed to fetch sequence steps" };
    }
    const nextSendAt = enrollmentDueAtIso(
      enrolledAt,
      Number(firstStep?.day_offset ?? 0)
    );

    const { error } = await supabase.from("sequence_enrollments").insert({
      client_id: clientId,
      sequence_id: seqId,
      status: "active",
      enrolled_at: enrolledAt,
      next_send_at: nextSendAt,
    });
    if (error) return { ok: false, error: toUserFacingError(error.message) };
    return { ok: true };
  } catch (err) {
    console.error("[reminders/actions] ensureActiveSequenceEnrollment error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}
