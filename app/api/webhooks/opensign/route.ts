import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { opensignWebhookSecret } from "@/lib/esign/config";
import { verifyOpensignWebhookSignature } from "@/lib/esign/hmac";
import { persistCompletedEsign } from "@/lib/esign/persist-completed";
import type { EsignKind, EsignStatus } from "@/lib/esign/types";

const EVENT_STATUS: Record<string, EsignStatus> = {
  created: "sent",
  viewed: "viewed",
  signed: "signed",
  completed: "completed",
  declined: "declined",
  revoked: "revoked",
};

export async function POST(request: Request) {
  const secret = opensignWebhookSecret();
  const signature = request.headers.get("x-webhook-signature");
  const rawBody = await request.text();

  if (!secret) {
    console.error("[opensign webhook] missing OPENSIGN_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!verifyOpensignWebhookSignature(rawBody, signature, secret)) {
    console.error("[opensign webhook] invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    event?: string;
    objectId?: string;
    file?: string;
    certificate?: string;
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const objectId = String(payload.objectId ?? "").trim();
  if (!objectId) {
    return NextResponse.json({ received: true });
  }

  const nextStatus = EVENT_STATUS[String(payload.event ?? "").toLowerCase()];
  if (!nextStatus) {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("esign_requests")
    .select("id, client_id, kind, status, signed_document_id")
    .eq("opensign_document_id", objectId)
    .maybeSingle();

  if (error || !row) {
    console.warn("[opensign webhook] unknown document", objectId);
    return NextResponse.json({ received: true });
  }

  if (row.status === "superseded") {
    return NextResponse.json({ received: true });
  }

  if (nextStatus === "completed") {
    await persistCompletedEsign({
      admin,
      requestId: row.id,
      clientId: row.client_id,
      kind: row.kind as EsignKind,
      signedFileUrl: payload.file ?? null,
      certificateUrl: payload.certificate ?? null,
    });
    return NextResponse.json({ received: true });
  }

  if (row.status !== "completed") {
    await admin
      .from("esign_requests")
      .update({ status: nextStatus })
      .eq("id", row.id);
  }

  return NextResponse.json({ received: true });
}
