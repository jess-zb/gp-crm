import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDeliverableEmail } from "@/lib/email/is-deliverable-email";
import { renderStaffEmailTemplate } from "@/lib/email/render-staff-email";
import type { StaffTemplateKey } from "@/emails/staff-index";
import { FROM_EMAIL, publicAppUrl } from "@/lib/constants/business-contact";
import type { AttorneyPortalAssignmentEmailProps } from "@/emails/_staff-types";

const FROM = FROM_EMAIL;

type ResendLike = {
  emails: {
    send: (args: {
      from: string;
      to: string;
      subject: string;
      html: string;
    }) => Promise<{ data: { id?: string } | null; error: { message: string } | null }>;
  };
};

export type StaffEmailQueueRow = {
  id: string;
  template_key: string;
  to_email: string;
  recipient_user_id: string | null;
  variables: Record<string, unknown>;
};

export type StaffEmailDispatchResult = {
  processed: number;
  errors: number;
  message?: string;
};

async function staffEmailDispatchEnabled(
  supabase: SupabaseClient
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: setting } = await supabase
    .from("crm_settings")
    .select("value")
    .eq("key", "email_sequences_enabled")
    .maybeSingle();

  if (setting?.value !== "true") {
    return { ok: false, reason: "email_sequences_disabled" };
  }

  if (!process.env.RESEND_API_KEY?.trim()) {
    return { ok: false, reason: "missing_resend_key" };
  }

  return { ok: true };
}

async function sendStaffEmailViaResend(args: {
  templateKey: StaffTemplateKey;
  toEmail: string;
  variables: Record<string, unknown>;
}): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    return { ok: false, error: "missing_resend_key" };
  }

  try {
    const { subject, html } = await renderStaffEmailTemplate(
      args.templateKey,
      args.variables
    );
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey) as unknown as ResendLike;
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: args.toEmail,
      subject,
      html,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, messageId: data?.id ?? undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "send_failed",
    };
  }
}

/** Queue a staff/attorney email for the dispatch-emails cron job. */
export async function queueStaffEmail(
  supabase: SupabaseClient,
  args: {
    templateKey: StaffTemplateKey;
    toEmail: string;
    recipientUserId?: string | null;
    variables: Record<string, unknown>;
    scheduledAt?: string;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const toEmail = args.toEmail.trim();
  if (!isDeliverableEmail(toEmail)) {
    return { ok: false, error: "Invalid recipient email." };
  }

  const { data, error } = await supabase
    .from("staff_email_queue")
    .insert({
      template_key: args.templateKey,
      to_email: toEmail,
      recipient_user_id: args.recipientUserId ?? null,
      variables: args.variables,
      status: "pending",
      scheduled_at: args.scheduledAt ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to queue email." };
  }
  return { ok: true, id: data.id as string };
}

/**
 * Send a staff email immediately via Resend. On failure (or when send is
 * unavailable), queue for the dispatch-emails cron as backup.
 */
export async function sendStaffEmailNowWithQueueFallback(
  supabase: SupabaseClient,
  args: {
    templateKey: StaffTemplateKey;
    toEmail: string;
    recipientUserId?: string | null;
    variables: Record<string, unknown>;
  }
): Promise<
  | { ok: true; mode: "sent_now" }
  | { ok: true; mode: "queued_for_cron"; queueId: string }
  | { ok: false; error: string }
> {
  const toEmail = args.toEmail.trim();
  if (!isDeliverableEmail(toEmail)) {
    return { ok: false, error: "Invalid recipient email." };
  }

  const enabled = await staffEmailDispatchEnabled(supabase);
  if (enabled.ok) {
    const sent = await sendStaffEmailViaResend({
      templateKey: args.templateKey,
      toEmail,
      variables: args.variables,
    });
    if (sent.ok) {
      return { ok: true, mode: "sent_now" };
    }
    const queued = await queueStaffEmail(supabase, args);
    if (queued.ok) {
      return { ok: true, mode: "queued_for_cron", queueId: queued.id };
    }
    return { ok: false, error: sent.error };
  }

  const queued = await queueStaffEmail(supabase, args);
  if (queued.ok) {
    return { ok: true, mode: "queued_for_cron", queueId: queued.id };
  }
  return { ok: false, error: enabled.reason };
}

export async function runStaffEmailDispatch(
  opts: { limit?: number } = {}
): Promise<StaffEmailDispatchResult> {
  const supabase = createAdminClient();

  const enabled = await staffEmailDispatchEnabled(supabase);
  if (!enabled.ok) {
    return { processed: 0, errors: 0, message: enabled.reason };
  }

  const nowIso = new Date().toISOString();
  const { data: rows, error: fetchErr } = await supabase
    .from("staff_email_queue")
    .select("id, template_key, to_email, recipient_user_id, variables")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(opts.limit ?? 50);

  if (fetchErr) {
    return { processed: 0, errors: 1, message: fetchErr.message };
  }
  if (!rows?.length) {
    return { processed: 0, errors: 0, message: "no_staff_emails_due" };
  }

  let processed = 0;
  let errors = 0;

  for (const row of rows as StaffEmailQueueRow[]) {
    try {
      const templateKey = row.template_key as StaffTemplateKey;
      const sent = await sendStaffEmailViaResend({
        templateKey,
        toEmail: row.to_email,
        variables: row.variables ?? {},
      });

      if (!sent.ok) {
        errors++;
        await supabase
          .from("staff_email_queue")
          .update({
            status: "failed",
            error: sent.error,
            sent_at: nowIso,
          })
          .eq("id", row.id);
        continue;
      }

      processed++;
      await supabase
        .from("staff_email_queue")
        .update({
          status: "sent",
          sent_at: nowIso,
          error: null,
          resend_message_id: sent.messageId ?? null,
        })
        .eq("id", row.id);
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : "send_failed";
      await supabase
        .from("staff_email_queue")
        .update({ status: "failed", error: msg, sent_at: nowIso })
        .eq("id", row.id);
    }
  }

  return { processed, errors };
}

export function buildAttorneyPortalAssignmentVariables(args: {
  attorneyName: string;
  clientSummaries: { id: string; name: string }[];
  casesUrl: string;
}): AttorneyPortalAssignmentEmailProps {
  const baseUrl = publicAppUrl();
  const nameParts = args.attorneyName.trim().split(/\s+/).filter(Boolean);
  return {
    attorney: {
      firstName: nameParts[0] ?? "Attorney",
      lastName: nameParts.slice(1).join(" "),
    },
    casesUrl: args.casesUrl,
    clients: args.clientSummaries.map((c) => ({
      name: c.name,
      caseUrl: `${baseUrl}/attorney/cases/${c.id}`,
    })),
  };
}
