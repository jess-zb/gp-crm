import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUSINESS_NAME,
  FROM_EMAIL,
  SUPPORT_EMAIL,
  WEBSITE_URL,
  publicAppUrl,
} from "@/lib/constants/business-contact";
import { renderTemplate } from "@/lib/email/render-template";
import { isDeliverableEmail } from "@/lib/email/is-deliverable-email";
import type { EmailProps } from "@/emails/_types";

const FROM = FROM_EMAIL;
const FALLBACK_AM_EMAIL = SUPPORT_EMAIL;
const MAX_STEP_ADVANCE_LOOPS = 25;

type ResendLike = {
  emails: {
    send: (args: {
      from: string;
      to: string;
      reply_to?: string;
      subject: string;
      html: string;
      headers?: Record<string, string>;
    }) => Promise<{ data: { id?: string } | null; error: { message: string } | null }>;
  };
};

type DueEnrollment = {
  id: string;
  client_id: string;
  sequence_key: string | null;
  sequence_id: string | null;
  enrolled_at: string;
  last_step_sent: number | null;
  skipped_step_orders: number[] | null;
};

export type DispatchResult = {
  processed: number;
  skipped_steps: number;
  errors: number;
  message?: string;
};

/**
 * Run the email dispatcher. Pass `clientId` to dispatch only for one
 * client (used by the inline send on stage change); omit for the
 * full hourly cron sweep.
 */
export async function runEmailDispatch(
  opts: { clientId?: string; limit?: number } = {}
): Promise<DispatchResult> {
  const supabase = createAdminClient();

  const { data: setting } = await supabase
    .from("crm_settings")
    .select("value")
    .eq("key", "email_sequences_enabled")
    .maybeSingle();

  if (setting?.value !== "true") {
    return { processed: 0, skipped_steps: 0, errors: 0, message: "email_sequences_disabled" };
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    return { processed: 0, skipped_steps: 0, errors: 0, message: "missing_resend_key" };
  }

  const nowIso = new Date().toISOString();
  let query = supabase
    .from("sequence_enrollments")
    .select(
      "id, client_id, sequence_key, sequence_id, enrolled_at, last_step_sent, skipped_step_orders"
    )
    .eq("status", "active")
    .lte("next_send_at", nowIso)
    .limit(opts.limit ?? 100);

  if (opts.clientId) {
    query = query.eq("client_id", opts.clientId);
  }

  const { data: enrollments, error: enrollErr } = await query;
  if (enrollErr) {
    return { processed: 0, skipped_steps: 0, errors: 1, message: enrollErr.message };
  }
  if (!enrollments?.length) {
    return { processed: 0, skipped_steps: 0, errors: 0, message: "no_emails_due" };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(resendKey) as unknown as ResendLike;

  let processed = 0;
  let skipped_steps = 0;
  let errors = 0;

  for (const enrollment of enrollments) {
    try {
      const outcome = await dispatchOne(supabase, resend, enrollment as DueEnrollment, nowIso);
      if (outcome === "sent") processed++;
      else if (outcome === "skipped_step") skipped_steps++;
      else if (outcome === "error") errors++;
    } catch (err) {
      console.error("[dispatch] error on enrollment", enrollment.id, err);
      errors++;
    }
  }

  return { processed, skipped_steps, errors };
}

type DispatchOutcome = "sent" | "skipped_step" | "completed" | "cancelled" | "no_template" | "error";

async function dispatchOne(
  supabase: SupabaseClient,
  resend: ResendLike,
  enrollment: DueEnrollment,
  nowIso: string
): Promise<DispatchOutcome> {
  const enrollmentId = String(enrollment.id);
  const skipSet = new Set<number>(
    Array.isArray(enrollment.skipped_step_orders) ? enrollment.skipped_step_orders : []
  );

  // Resolve text sequence key — backfill if only UUID is set
  let sequenceKey = String(enrollment.sequence_key ?? "").trim();
  if (!sequenceKey && enrollment.sequence_id) {
    const { data: seq } = await supabase
      .from("email_sequences")
      .select("key")
      .eq("id", enrollment.sequence_id)
      .maybeSingle();
    sequenceKey = (seq?.key as string | undefined) ?? "";
    if (sequenceKey) {
      await supabase
        .from("sequence_enrollments")
        .update({ sequence_key: sequenceKey })
        .eq("id", enrollmentId);
    }
  }
  if (!sequenceKey) return "no_template";

  // Walk forward past any skipped step_orders until we find a real one to send
  let candidateStep = Number(enrollment.last_step_sent ?? 0) + 1;
  let candidateTmpl: { template_key: string; day_offset: number | null } | null = null;
  let advancedPastSkip = false;

  for (let loop = 0; loop < MAX_STEP_ADVANCE_LOOPS; loop++) {
    const { data: tmpl } = await supabase
      .from("comm_templates")
      .select("template_key, day_offset")
      .eq("sequence_key", sequenceKey)
      .eq("step_order", candidateStep)
      .eq("is_active", true)
      .maybeSingle();

    if (!tmpl) {
      // No more steps — sequence complete
      await supabase
        .from("sequence_enrollments")
        .update({
          status: "completed",
          completed_at: nowIso,
          next_send_at: null,
          last_step_sent: candidateStep - 1,
          current_step: candidateStep - 1,
        })
        .eq("id", enrollmentId);
      return "completed";
    }

    if (!skipSet.has(candidateStep)) {
      candidateTmpl = {
        template_key: String(tmpl.template_key),
        day_offset: tmpl.day_offset == null ? null : Number(tmpl.day_offset),
      };
      break;
    }

    advancedPastSkip = true;
    candidateStep++;
  }

  if (!candidateTmpl) return "no_template";

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, assigned_to, is_active, unsubscribed_at")
    .eq("id", enrollment.client_id)
    .maybeSingle();

  // Schema/query failures must not look like "inactive" — that falsely cancelled
  // every due enrollment while clients.unsubscribed_at was missing in prod.
  if (clientErr) {
    console.error("[dispatch] client fetch error", enrollment.client_id, clientErr.message);
    return "error";
  }

  // Missing row is not the same as inactive — leave enrollment for retry/investigation.
  if (!client) {
    console.error("[dispatch] client row missing", enrollment.client_id);
    return "error";
  }

  // Never send to inactive clients — cancel their enrollment
  if (client.is_active === false) {
    await supabase
      .from("sequence_enrollments")
      .update({
        status: "cancelled",
        next_send_at: null,
        cancelled_at: nowIso,
        cancel_reason: "client_inactive",
      })
      .eq("id", enrollmentId);
    return "cancelled";
  }

  // Respect an unsubscribe (set by the /unsubscribe page or a Resend
  // bounce/complaint webhook) — cancel so we never email them again.
  if (client.unsubscribed_at) {
    await supabase
      .from("sequence_enrollments")
      .update({
        status: "cancelled",
        next_send_at: null,
        cancelled_at: nowIso,
        cancel_reason: "unsubscribed",
      })
      .eq("id", enrollmentId);
    return "cancelled";
  }

  // No usable email — cancel so we don't retry every hour and rack up Resend failures
  if (!isDeliverableEmail(client.email)) {
    await supabase
      .from("sequence_enrollments")
      .update({
        status: "cancelled",
        next_send_at: null,
        cancelled_at: nowIso,
        cancel_reason: "invalid_email",
      })
      .eq("id", enrollmentId);
    return "cancelled";
  }

  const { data: am } = client.assigned_to
    ? await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", client.assigned_to)
        .maybeSingle()
    : { data: null };

  const amParts = String(am?.full_name ?? "").split(" ");
  const variables: EmailProps = {
    client: {
      firstName: (client.first_name as string | null) ?? "",
      lastName: (client.last_name as string | null) ?? "",
    },
    accountManager: {
      firstName: amParts[0] || BUSINESS_NAME,
      lastName: amParts.slice(1).join(" ") || "Team",
      title: "Account Manager",
      email: String(am?.email ?? FALLBACK_AM_EMAIL).trim(),
    },
    portalUrl: `${publicAppUrl()}/portal/${String(client.id)}`,
    unsubscribeUrl: `${publicAppUrl()}/unsubscribe/${String(client.id)}`,
  };

  let subject = "";
  let html = "";
  try {
    const rendered = await renderTemplate({ template_key: candidateTmpl.template_key, variables });
    subject = rendered.subject;
    html = rendered.html;
  } catch (renderErr) {
    console.error("[dispatch] render error for", candidateTmpl.template_key, renderErr);
    return "error";
  }

  const replyTo = String(am?.email ?? FALLBACK_AM_EMAIL).trim();
  const { data: sendData, error: sendError } = await resend.emails.send({
    from: FROM,
    to: client.email as string,
    reply_to: replyTo,
    subject,
    html,
    headers: { "List-Unsubscribe": `<${variables.unsubscribeUrl}>` },
  });

  await supabase.from("email_logs").insert({
    enrollment_id: enrollmentId,
    client_id: client.id,
    sequence_id: sequenceKey,
    step: candidateStep,
    subject,
    sent_at: nowIso,
    status: sendError ? "failed" : "sent",
    error: sendError?.message ?? null,
    resend_message_id: sendData?.id ?? null,
  });

  if (sendError) return "error";

  await advanceEnrollment(supabase, enrollmentId, enrollment, sequenceKey, candidateStep, nowIso);
  return "sent";
}

async function advanceEnrollment(
  supabase: SupabaseClient,
  enrollmentId: string,
  enrollment: DueEnrollment,
  sequenceKey: string,
  justFinishedStep: number,
  nowIso: string
): Promise<void> {
  const { data: nextTmpl } = await supabase
    .from("comm_templates")
    .select("day_offset")
    .eq("sequence_key", sequenceKey)
    .eq("step_order", justFinishedStep + 1)
    .eq("is_active", true)
    .maybeSingle();

  if (nextTmpl?.day_offset != null) {
    const enrolledAt = new Date(String(enrollment.enrolled_at));
    const nextSendAt = new Date(enrolledAt);
    nextSendAt.setDate(nextSendAt.getDate() + Number(nextTmpl.day_offset));
    await supabase
      .from("sequence_enrollments")
      .update({
        last_step_sent: justFinishedStep,
        current_step: justFinishedStep,
        next_send_at: nextSendAt.toISOString(),
      })
      .eq("id", enrollmentId);
  } else {
    await supabase
      .from("sequence_enrollments")
      .update({
        last_step_sent: justFinishedStep,
        current_step: justFinishedStep,
        status: "completed",
        completed_at: nowIso,
        next_send_at: null,
      })
      .eq("id", enrollmentId);
  }
}
