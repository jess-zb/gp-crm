import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessClientRecord } from "@/lib/roles";
import { canUseEsignStaffUi, isEsignFeatureEnabled } from "@/lib/esign/config";
import {
  canShowEsignActions,
  esignKindTitle,
  esignSentAuditAction,
  isEsignKind,
  type EsignKind,
} from "@/lib/esign/types";
import { createSignToken, signLinkExpiresAt } from "@/lib/esign/tokens";
import { sendEsignInviteEmail } from "@/lib/esign/send-invite-email";
import { publicAppUrl } from "@/lib/constants/business-contact";
import { toUserFacingError } from "@/lib/user-facing-error";
import { missingRequiredReviewLabels } from "@/lib/esign/review-fields";

function documentTitle(kind: EsignKind): string {
  return esignKindTitle(kind);
}

export async function POST(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canUseEsignStaffUi(profile.role, user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { clientId?: string; kind?: string; prefill?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = String(body.clientId ?? "").trim();
  const kindRaw = String(body.kind ?? "").trim();
  if (!clientId || !isEsignKind(kindRaw)) {
    return NextResponse.json({ error: "Invalid client or document type." }, { status: 400 });
  }
  const kind: EsignKind = kindRaw;
  const missing = missingRequiredReviewLabels(kind, body.prefill ?? {});
  if (missing.length) {
    return NextResponse.json(
      { error: `Fill required fields: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, stage, assigned_to, attorney_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!canAccessClientRecord(profile.role, user.id, client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canShowEsignActions(client.stage as string | null)) {
    return NextResponse.json(
      { error: "E-Sign is only available in Account Manager or Client Services." },
      { status: 400 }
    );
  }

  const { data: alreadyFiled } = await supabase
    .from("esign_requests")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", kind)
    .eq("status", "completed")
    .not("signed_document_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (alreadyFiled?.id) {
    return NextResponse.json(
      { error: "A signed copy is already on Uploads. Send is locked." },
      { status: 400 }
    );
  }

  const email = String(client.email ?? "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Add the client's email on the Account tab before sending." },
      { status: 400 }
    );
  }

  const signerName =
    String(body.prefill?.fullName ?? "").trim() ||
    `${String(client.first_name ?? "").trim()} ${String(client.last_name ?? "").trim()}`.trim() ||
    "Client";
  const token = createSignToken();
  const signUrl = `${publicAppUrl()}/sign/${token}`;

  const { data: pending } = await supabase
    .from("esign_requests")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", kind)
    .in("status", ["sent", "viewed", "signed"])
    .limit(20);
  if (pending?.length) {
    await supabase
      .from("esign_requests")
      .update({ status: "superseded" })
      .in("id", pending.map((row) => row.id));
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("esign_requests")
    .insert({
      client_id: clientId,
      kind,
      status: "sent",
      signer_email: email,
      signer_name: signerName,
      sent_by: user.id,
      sign_token: token,
      token_expires_at: signLinkExpiresAt().toISOString(),
      prefill_snapshot: body.prefill ?? null,
    })
    .select("id, status, sent_at")
    .single();

  if (insertErr || !inserted) {
    console.error("[esign send] insert", insertErr?.message);
    return NextResponse.json({ error: "Could not record the request." }, { status: 500 });
  }

  const mailed = await sendEsignInviteEmail({
    to: email,
    signerName,
    kind,
    documentTitle: documentTitle(kind),
    signUrl,
  });
  if (!mailed.ok) {
    await supabase
      .from("esign_requests")
      .update({ status: "failed", last_error: mailed.error })
      .eq("id", inserted.id);
    return NextResponse.json({ error: toUserFacingError(mailed.error) }, { status: 502 });
  }

  await createAdminClient().from("esign_events").insert({
    request_id: inserted.id,
    event: "sent",
    meta: { kind },
  });
  await supabase.from("audit_log").insert({
    client_id: clientId,
    action: esignSentAuditAction(kind),
    new_value: { request_id: inserted.id, channel: "crm" },
    performed_by: user.id,
    performed_by_name: profile.full_name?.trim() || "Staff",
  });

  return NextResponse.json({
    ok: true,
    requestId: inserted.id,
    status: "sent",
    sentAt: inserted.sent_at,
  });
}
