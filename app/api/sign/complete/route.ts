import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEsignFeatureEnabled } from "@/lib/esign/config";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/esign/request-ip";
import { loadEsignPrefill, mergeSignerOverrides } from "@/lib/esign/load-prefill";
import { loadEsignLayout } from "@/lib/esign/load-layout";
import { flattenSignedPdf } from "@/lib/esign/flatten-signed-pdf";
import { stampSignedFormPages, appendCertificatePages } from "@/lib/esign/stamp-completed";
import { buildCertificatePdf } from "@/lib/esign/certificate-pdf";
import { persistCompletedEsignBytes } from "@/lib/esign/persist-completed";
import { sendEsignCompletedEmail } from "@/lib/esign/send-invite-email";
import { esignKindTitle, esignSignedFileStem, type EsignKind } from "@/lib/esign/types";
import type { EsignClientPrefill } from "@/lib/esign/map-client-prefill";
import { signerDisplayName } from "@/lib/esign/map-client-prefill";
import { missingRequiredReviewLabels } from "@/lib/esign/review-fields";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PNG = 400_000;

function pngFromDataUrl(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const buf = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  if (buf.length < 32 || buf.length > MAX_PNG) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return new Uint8Array(buf);
}

export async function POST(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }

  let body: {
    token?: string;
    signaturePng?: string;
    signatureFieldIds?: string[];
    intentAccepted?: boolean;
    fields?: Partial<EsignClientPrefill> & { fullName?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  if (!body.intentAccepted) {
    return NextResponse.json(
      { error: "Confirm that you intend to sign electronically." },
      { status: 400 }
    );
  }
  const signaturePng = pngFromDataUrl(String(body.signaturePng ?? ""));
  if (!signaturePng) {
    return NextResponse.json({ error: "Draw or type your signature first." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("esign_requests")
    .select(
      "id, client_id, kind, status, signer_name, signer_email, sent_at, sent_by, token_expires_at, viewed_at, viewed_ip, cert_ref, signed_document_id, prefill_snapshot"
    )
    .eq("sign_token", token)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  const expires = row.token_expires_at ? new Date(row.token_expires_at) : null;
  if (expires && expires.getTime() < Date.now()) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }
  if (row.status === "superseded" || row.status === "revoked") {
    return NextResponse.json({ error: "This link was replaced. Use the latest email." }, { status: 410 });
  }
  if (row.status === "completed" && row.signed_document_id) {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  const kind = row.kind as EsignKind;
  const prefill = mergeSignerOverrides(
    mergeSignerOverrides(
      await loadEsignPrefill(admin, row.client_id),
      (row.prefill_snapshot as Record<string, string> | null) ?? null
    ),
    body.fields
  );
  const missing = missingRequiredReviewLabels(kind, {
    ...prefill,
    fullName: String(body.fields?.fullName ?? "").trim() || signerDisplayName(prefill),
  });
  if (missing.length) {
    return NextResponse.json(
      { error: `Fill required fields: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const ip = clientIpFromRequest(request);
  const userAgent = userAgentFromRequest(request);
  const signedAt = new Date().toISOString();
  const signedDate = new Date().toLocaleDateString("en-US");

  await admin
    .from("esign_requests")
    .update({
      status: "signed",
      signed_ip: ip,
      user_agent: userAgent,
      intent_accepted_at: signedAt,
    })
    .eq("id", row.id);

  await admin.from("esign_events").insert({
    request_id: row.id,
    event: "signed",
    ip,
    user_agent: userAgent,
    meta: { auth: "email_link", cert_ref: row.cert_ref },
  });
  const layout = await loadEsignLayout(admin, kind);
  const signatureFieldIds = Array.isArray(body.signatureFieldIds)
    ? body.signatureFieldIds.filter((id) => typeof id === "string" && id.trim())
    : layout.filter((f) => f.bind === "signature").map((f) => f.id);
  const signedPdf = await flattenSignedPdf({
    kind,
    prefill,
    signaturePng,
    signedDate,
    fields: layout,
    signatureFieldIds,
  });
  const stampedForm = await stampSignedFormPages(signedPdf, row.cert_ref);
  const sha256 = createHash("sha256").update(stampedForm).digest("hex");

  let originatorName = "Staff";
  let originatorEmail = "";
  if (row.sent_by) {
    const { data: sender } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", row.sent_by)
      .maybeSingle();
    originatorName = String(sender?.full_name ?? "").trim() || "Staff";
    originatorEmail = String(sender?.email ?? "").trim();
  }

  const documentName = esignKindTitle(kind);
  const certificatePdf = await buildCertificatePdf({
    requestId: row.id,
    documentName,
    sha256,
    createdAt: row.sent_at,
    completedAt: signedAt,
    originatorName,
    originatorEmail,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    viewedAt: row.viewed_at,
    viewedIp: row.viewed_ip,
    signedAt,
    signedIp: ip,
    certRef: row.cert_ref,
    signaturePng,
  });
  const packetPdf = await appendCertificatePages(stampedForm, certificatePdf);

  const saved = await persistCompletedEsignBytes({
    admin,
    requestId: row.id,
    clientId: row.client_id,
    kind,
    signedPdf: packetPdf,
    sha256,
    uploadedBy: row.sent_by,
  });

  if (!saved.signedId) {
    return NextResponse.json(
      { error: "Signed, but the file could not be saved. Please try again." },
      { status: 500 }
    );
  }

  const fileName = `${esignSignedFileStem(kind)}-signed.pdf`;
  const mailed = await sendEsignCompletedEmail({
    to: row.signer_email,
    signerName: row.signer_name,
    documentTitle: documentName,
    pdf: packetPdf,
    fileName,
  });
  if (!mailed.ok) {
    console.warn("[esign complete] client copy email", mailed.error);
  }

  await admin.from("esign_events").insert({
    request_id: row.id,
    event: "completed",
    ip,
    user_agent: userAgent,
    meta: {
      sha256,
      signed_document_id: saved.signedId,
      client_copy_emailed: mailed.ok,
      client_copy_error: mailed.ok ? null : mailed.error,
    },
  });

  return NextResponse.json({ ok: true, emailed: mailed.ok });
}
