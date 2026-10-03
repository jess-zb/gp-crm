import { Resend } from "resend";
import {
  FROM_EMAIL,
  BUSINESS_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  WEBSITE_URL,
  publicAppUrl,
} from "@/lib/constants/business-contact";

const TRANSACTIONAL_HEADERS = {
  "List-Unsubscribe": `<mailto:${SUPPORT_EMAIL}>`,
};

export async function sendEsignInviteEmail(args: {
  to: string;
  signerName: string;
  /** welcome_packet uses the welcome letter; every other behaviour uses the generic one. */
  behavior?: string;
  documentTitle: string;
  signUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "Email is not configured (RESEND_API_KEY)." };

  const logoSrc = `${publicAppUrl()}/logo.png`;
  const html =
    args.behavior === "welcome_packet"
      ? welcomePacketInviteHtml({ logoSrc, signUrl: args.signUrl })
      : ccAuthInviteHtml({
          logoSrc,
          signerName: args.signerName,
          documentTitle: args.documentTitle,
          signUrl: args.signUrl,
        });
  const text =
    args.behavior === "welcome_packet"
      ? welcomePacketInviteText(args.signUrl)
      : ccAuthInviteText(args.signerName, args.documentTitle, args.signUrl);
  const subject =
    args.behavior === "welcome_packet"
      ? `${BUSINESS_NAME}: your Virtual Welcome Packet is ready`
      : `${BUSINESS_NAME}: your ${args.documentTitle} is ready`;

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: args.to,
    replyTo: SUPPORT_EMAIL,
    subject,
    text,
    html,
    headers: TRANSACTIONAL_HEADERS,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function brandFooterHtml(): string {
  return `
        <div style="border-top:1px solid #e2e8f0;padding:16px 24px;font-size:13px;line-height:1.55;color:#64748b;">
          <p style="margin:0 0 6px;">${escapeHtml(BUSINESS_NAME)} · ${escapeHtml(SUPPORT_EMAIL)} · ${escapeHtml(SUPPORT_PHONE)}</p>
          <p style="margin:0;"><a href="${escapeHtml(WEBSITE_URL)}" style="color:#334155;">${escapeHtml(WEBSITE_URL)}</a></p>
        </div>`;
}

function brandFooterText(): string {
  return `${BUSINESS_NAME}\n${SUPPORT_EMAIL} · ${SUPPORT_PHONE}\n${WEBSITE_URL}`;
}

function welcomePacketInviteHtml(args: { logoSrc: string; signUrl: string }): string {
  return `
    <div style="margin:0;padding:24px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0A2540;padding:20px 24px;">
          <img src="${args.logoSrc}" alt="${escapeHtml(BUSINESS_NAME)}" width="160" style="display:block;border:0;" />
        </div>
        <div style="padding:24px;font-size:15px;line-height:1.55;color:#334155;">
          <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;">Welcome to ${escapeHtml(BUSINESS_NAME)}</p>
          <p style="margin:0 0 20px;">Please review and complete your Virtual Welcome Packet when you have a moment.</p>
          <p style="margin:0 0 12px;">
            <a href="${escapeHtml(args.signUrl)}" style="display:inline-block;background:#8DE3B5;color:#0A2540;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Review document</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748b;word-break:break-all;">
            Or open this ${escapeHtml(BUSINESS_NAME)} link:<br/>
            <a href="${escapeHtml(args.signUrl)}" style="color:#334155;">${escapeHtml(args.signUrl)}</a>
          </p>
          <p style="margin:0 0 8px;">Questions? Email ${escapeHtml(SUPPORT_EMAIL)} or call ${escapeHtml(SUPPORT_PHONE)}.</p>
          <p style="margin:0 0 16px;">Thank you for choosing ${escapeHtml(BUSINESS_NAME)}. We look forward to assisting you.</p>
          <p style="margin:0;">Sincerely,<br/>The ${escapeHtml(BUSINESS_NAME)} Team</p>
        </div>
        ${brandFooterHtml()}
      </div>
    </div>
  `;
}

function welcomePacketInviteText(signUrl: string): string {
  return [
    `Welcome to ${BUSINESS_NAME}`,
    "",
    "Please review and complete your Virtual Welcome Packet when you have a moment.",
    "",
    `Review document: ${signUrl}`,
    "",
    `Questions? Email ${SUPPORT_EMAIL} or call ${SUPPORT_PHONE}.`,
    "",
    `Thank you for choosing ${BUSINESS_NAME}.`,
    `The ${BUSINESS_NAME} Team`,
    "",
    brandFooterText(),
  ].join("\n");
}

function ccAuthInviteHtml(args: {
  logoSrc: string;
  signerName: string;
  documentTitle: string;
  signUrl: string;
}): string {
  return `
    <div style="margin:0;padding:24px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0A2540;padding:20px 24px;">
          <img src="${args.logoSrc}" alt="${escapeHtml(BUSINESS_NAME)}" width="160" style="display:block;border:0;" />
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hi ${escapeHtml(args.signerName)},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155;">
            ${escapeHtml(BUSINESS_NAME)} needs you to review and sign your
            <strong>${escapeHtml(args.documentTitle)}</strong>.
          </p>
          <p style="margin:0 0 12px;">
            <a href="${escapeHtml(args.signUrl)}" style="display:inline-block;background:#8DE3B5;color:#0A2540;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Review document</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748b;word-break:break-all;">
            Or open this ${escapeHtml(BUSINESS_NAME)} link:<br/>
            <a href="${escapeHtml(args.signUrl)}" style="color:#334155;">${escapeHtml(args.signUrl)}</a>
          </p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">
            This link expires in 14 days. If you did not expect this email from ${escapeHtml(BUSINESS_NAME)}, call us at ${escapeHtml(SUPPORT_PHONE)}.
          </p>
        </div>
        ${brandFooterHtml()}
      </div>
    </div>
  `;
}

function ccAuthInviteText(
  signerName: string,
  documentTitle: string,
  signUrl: string
): string {
  return [
    `Hi ${signerName},`,
    "",
    `${BUSINESS_NAME} needs you to review and sign your ${documentTitle}.`,
    "",
    `Review document: ${signUrl}`,
    "",
    `This link expires in 14 days. If you did not expect this email from ${BUSINESS_NAME}, call ${SUPPORT_PHONE}.`,
    "",
    brandFooterText(),
  ].join("\n");
}

export async function sendEsignCompletedEmail(args: {
  to: string;
  signerName: string;
  documentTitle: string;
  pdf: Uint8Array;
  fileName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "Email is not configured (RESEND_API_KEY)." };

  const logoSrc = `${publicAppUrl()}/logo.png`;
  const html = `
    <div style="margin:0;padding:24px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0A2540;padding:20px 24px;">
          <img src="${logoSrc}" alt="${escapeHtml(BUSINESS_NAME)}" width="160" style="display:block;border:0;" />
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hi ${escapeHtml(args.signerName)},</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">
            ${escapeHtml(BUSINESS_NAME)} has saved your signed ${escapeHtml(args.documentTitle)} on your account. A PDF copy is attached.
          </p>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#334155;">
            Please let your representative know everything is done on your end.
          </p>
        </div>
        ${brandFooterHtml()}
      </div>
    </div>
  `;
  const text = [
    `Hi ${args.signerName},`,
    "",
    `${BUSINESS_NAME} has saved your signed ${args.documentTitle} on your account. A PDF copy is attached.`,
    "",
    "Please let your representative know everything is done on your end.",
    "",
    brandFooterText(),
  ].join("\n");

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: args.to,
    replyTo: SUPPORT_EMAIL,
    subject: `${BUSINESS_NAME}: your signed ${args.documentTitle}`,
    text,
    html,
    headers: TRANSACTIONAL_HEADERS,
    attachments: [
      {
        filename: args.fileName,
        content: Buffer.from(args.pdf),
      },
    ],
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
