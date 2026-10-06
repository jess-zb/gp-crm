import { Resend } from "resend";
import { BUSINESS_NAME, FROM_EMAIL, publicAppUrl } from "@/lib/constants/business-contact";

function appBaseUrl(): string {
  return publicAppUrl();
}

export type AttorneyCollectionLetterEmailParams = {
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  attorneyEmail: string;
};

/** Legacy per-upload attorney emails (collection letter upload path). */
export const ATTORNEY_EMAIL_NOTIFICATIONS_ENABLED = false;

export type AttorneyPortalAssignmentEmailParams = {
  attorneyEmail: string;
  attorneyName: string;
  clientSummaries: { id: string; name: string }[];
  casesUrl: string;
};

/**
 * Notifies an attorney that new case(s) were assigned via the Attorney Queue.
 */
export async function sendAttorneyPortalAssignmentEmail(
  params: AttorneyPortalAssignmentEmailParams
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  const count = params.clientSummaries.length;
  const subject =
    count === 1
      ? `New Case Assigned — ${params.clientSummaries[0]?.name ?? "Client"}`
      : `${count} New Cases Assigned`;

  const clientLines = params.clientSummaries
    .map(
      (c) =>
        `• ${c.name} — ${appBaseUrl()}/attorney/cases/${c.id}`
    )
    .join("\n");

  const body = [
    `Hi ${params.attorneyName},`,
    "",
    count === 1
      ? "A new case has been assigned to you in the Golden Pathway attorney portal."
      : `${count} new cases have been assigned to you in the Golden Pathway attorney portal.`,
    "",
    clientLines,
    "",
    `View all cases: ${params.casesUrl}`,
    "",
    "Sign in with your attorney CRM credentials to review client contact info, the signed Welcome Packet, and collection letters.",
  ].join("\n");

  try {
    const resend = new Resend(apiKey);
    const sent = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.attorneyEmail,
      subject,
      text: body,
    });

    if ((sent as { error?: { message?: string } })?.error) {
      const msg =
        (sent as { error?: { message?: string } }).error?.message ||
        "Resend send failed";
      return { ok: false, error: msg };
    }

    const messageId = String((sent as { data?: { id?: string } })?.data?.id ?? "");
    return { ok: true, messageId: messageId || undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Notification request failed.",
    };
  }
}

/**
 * Sends collection-letter notification email to the assigned attorney via Resend.
 */
export async function sendAttorneyCollectionLetterEmail(
  params: AttorneyCollectionLetterEmailParams
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  if (!ATTORNEY_EMAIL_NOTIFICATIONS_ENABLED) {
    return {
      ok: false,
      error:
        "Attorney email notifications are disabled. Use the attorney batch queue instead.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  const clientName =
    `${params.clientFirstName} ${params.clientLastName}`.trim() || "Client";
  const viewUrl = `${appBaseUrl()}/clients/${params.clientId}`;

  const body = [
    `A collection letter has been uploaded for ${clientName}, ID: ${params.clientId}.`,
    "Please review and prepare for case submission.",
    `View client: ${viewUrl}`,
  ].join("\n\n");

  try {
    const resend = new Resend(apiKey);
    const sent = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.attorneyEmail,
      subject: `New Collection Letter — ${clientName}`,
      text: body,
    });

    if ((sent as { error?: { message?: string } })?.error) {
      const msg =
        (sent as { error?: { message?: string } }).error?.message ||
        "Resend send failed";
      return { ok: false, error: msg };
    }

    const messageId = String((sent as { data?: { id?: string } })?.data?.id ?? "");
    return { ok: true, messageId: messageId || undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Notification request failed.",
    };
  }
}

/**
 * @deprecated Prefer `sendAttorneyCollectionLetterEmail` with resolved attorney email.
 * Kept for callers that only have document + client ids (retry flow).
 */
export async function sendAttorneyCollectionLetterNotification(params: {
  documentId: string;
  clientId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  void params.documentId;
  return {
    ok: false,
    error: "Attorney email requires RESEND_API_KEY.",
  };
}
