import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEsignFeatureEnabled } from "@/lib/esign/config";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/esign/request-ip";
import { createOtpCode } from "@/lib/esign/tokens";

/**
 * Opening the emailed link authenticates the signer (DocuSign-style).
 * We mint a 6-digit certificate reference here — the client never types it.
 */
export async function POST(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = String(body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("esign_requests")
    .select("id, status, viewed_at, cert_ref, otp_verified_at")
    .eq("sign_token", token)
    .maybeSingle();
  if (!data || data.status === "superseded" || data.status === "completed") {
    return NextResponse.json({ ok: true, certRef: data?.cert_ref ?? null });
  }

  const ip = clientIpFromRequest(request);
  const userAgent = userAgentFromRequest(request);
  const now = new Date().toISOString();
  const certRef = (data.cert_ref as string | null) || createOtpCode();
  const patch: Record<string, string> = {
    user_agent: userAgent,
    cert_ref: certRef,
    otp_verified_at: (data.otp_verified_at as string | null) || now,
  };
  if (!data.viewed_at) {
    patch.viewed_at = now;
    patch.viewed_ip = ip;
    if (data.status === "sent") patch.status = "viewed";
  }
  await admin.from("esign_requests").update(patch).eq("id", data.id);
  if (!data.viewed_at) {
    await admin.from("esign_events").insert({
      request_id: data.id,
      event: "viewed",
      ip,
      user_agent: userAgent,
      meta: { auth: "email_link", cert_ref: certRef },
    });
  }
  return NextResponse.json({ ok: true, certRef });
}
