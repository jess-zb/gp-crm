import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTORNEY_EMAIL_NOTIFICATIONS_ENABLED } from "@/lib/attorney-notify";
import { sendAttorneyCollectionLetterEmail } from "@/lib/attorney-notify";
import { createWorkflowTask } from "@/lib/reminders/workflow";
import { createServiceClient } from "@/lib/supabase/server";

const CASE_SENT_APPOINTMENT_TYPE = "case_sent_notification";
const CASE_SENT_DESCRIPTION =
  "Call client to notify case sent to attorneys";

/**
 * Queue assign already emails the client (`case_referred`) and the attorney
 * (portal assignment). Flip to true to resume the CS callback appointment.
 */
const CREATE_CASE_SENT_NOTIFY_APPOINTMENT = false;

function addHoursIso(from: Date, hours: number): string {
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export type CaseSentTriggerSource = "collection_letter_upload" | "stage_change";

export type CaseSentTriggerResult = {
  attorneyEmail: string | null;
  emailSent: boolean;
  appointmentId: string | null;
};

async function ensureCaseSentNotificationAppointment(
  supabase: SupabaseClient,
  args: {
    clientId: string;
    assignedServicesId: string | null;
    performerId: string | null;
  }
): Promise<string | null> {
  const now = new Date();
  const dueIso = addHoursIso(now, 4);
  if (new Date(dueIso).getTime() <= now.getTime()) {
    return null;
  }

  const { count, error: countErr } = await supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("client_id", args.clientId)
    .eq("appointment_type", CASE_SENT_APPOINTMENT_TYPE)
    .eq("completed", false)
    .eq("cancelled", false);

  if (countErr) {
    console.error("[case-sent-triggers] count existing reminders error:", countErr.message);
  }

  if ((count ?? 0) > 0) {
    return null;
  }

  const { error } = await createWorkflowTask(supabase, {
    client_id: args.clientId,
    description: CASE_SENT_DESCRIPTION,
    due_date: dueIso,
    assigned_to: args.assignedServicesId,
    created_by: args.performerId,
    client_stage: "case_sent_to_attorneys",
    appointment_type: CASE_SENT_APPOINTMENT_TYPE,
    pipeline_type: "service",
    workflow_source: "system",
    auto_generated: true,
  });

  if (error) {
    console.error("[case-sent-triggers] appointment insert error:", error.message);
    return null;
  }

  const { data, error: fetchErr } = await supabase
    .from("reminders")
    .select("id")
    .eq("client_id", args.clientId)
    .eq("appointment_type", CASE_SENT_APPOINTMENT_TYPE)
    .eq("completed", false)
    .eq("cancelled", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) {
    console.error("[case-sent-triggers] fetch newly created appointment error:", fetchErr.message);
  }

  return (data?.id as string | undefined) ?? null;
}

/**
 * Case-sent side effects. Attorney email on this path is off
 * (`ATTORNEY_EMAIL_NOTIFICATIONS_ENABLED`). The CS "call the client" appointment
 * is also off — real notify is Attorney Queue assign (client drip + attorney mail).
 */
export async function runCaseSentToAttorneysTriggers(args: {
  clientId: string;
  performerId: string | null;
  source: CaseSentTriggerSource;
}): Promise<CaseSentTriggerResult> {
  const supabase = createServiceClient();
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select(
      "attorney_id, assigned_services_id, first_name, last_name"
    )
    .eq("id", args.clientId)
    .maybeSingle();

  if (clientErr) {
    console.error("[case-sent-triggers] fetch client error:", clientErr.message);
  }

  let attorneyEmail: string | null = null;
  let emailSent = false;

  if (ATTORNEY_EMAIL_NOTIFICATIONS_ENABLED && client?.attorney_id) {
    const { data: attorney, error: attyErr } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", client.attorney_id as string)
      .maybeSingle();

    if (attyErr) {
      console.error("[case-sent-triggers] fetch attorney profile error:", attyErr.message);
    }

    attorneyEmail = (attorney?.email as string | null)?.trim() || null;

    if (attorneyEmail) {
      const mail = await sendAttorneyCollectionLetterEmail({
        clientId: args.clientId,
        clientFirstName: (client.first_name as string | null) ?? "",
        clientLastName: (client.last_name as string | null) ?? "",
        attorneyEmail,
      });
      emailSent = mail.ok;
      if (!mail.ok) {
        console.warn("[case-sent-triggers] attorney email:", mail.error);
      }
    }
  }

  const appointmentId = CREATE_CASE_SENT_NOTIFY_APPOINTMENT
    ? await ensureCaseSentNotificationAppointment(supabase, {
        clientId: args.clientId,
        assignedServicesId:
          (client?.assigned_services_id as string | null) ?? null,
        performerId: args.performerId,
      })
    : null;

  if (args.source === "stage_change") {
    console.log("[StageChange] case_sent triggered:", {
      clientId: args.clientId,
      attorneyEmail,
      appointmentId,
      attorneyEmailDisabled: !ATTORNEY_EMAIL_NOTIFICATIONS_ENABLED,
    });
  }

  return { attorneyEmail, emailSent, appointmentId };
}
