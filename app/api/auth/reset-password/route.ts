import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUSINESS_NAME, FROM_EMAIL } from "@/lib/constants/business-contact";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

function getAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    const redirectTo = `${getAppOrigin()}/update-password`;

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: { redirectTo },
    });

    if (error) {
      // Don't surface whether the email exists — always look like success
      console.error("[reset-password] generateLink error:", error.message);
      return NextResponse.json({ ok: true });
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      console.error("[reset-password] no action_link returned");
      return NextResponse.json({ ok: true });
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email.trim().toLowerCase(),
      subject: `Reset your ${BUSINESS_NAME} CRM password`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
          <div style="background:#0A2540;border-radius:10px;padding:28px 32px;text-align:center;margin-bottom:24px;">
            <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;">DebtSupportPros CRM</h1>
          </div>
          <div style="background:#ffffff;border-radius:10px;padding:32px;border:1px solid #e2e8f0;">
            <h2 style="color:#0f172a;font-size:18px;font-weight:600;margin:0 0 12px;">Reset your password</h2>
            <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
              We received a request to reset the password for your account. Click the button below to set a new password.
            </p>
            <a href="${actionLink}"
               style="display:inline-block;background:#8DE3B5;color:#0A2540;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;">
              Reset password
            </a>
            <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">
              This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: true });
  }
}
