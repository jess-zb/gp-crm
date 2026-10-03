import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { layoutFromTemplate } from "./load-layout";
import type { EsignLayoutField } from "./layout";
import { ESIGN_TEMPLATE_SELECT, type EsignTemplateRow } from "./types";

export type SignTokenContext = {
  requestId: string;
  clientId: string;
  status: string;
  signerName: string;
  signerEmail: string;
  certRef: string | null;
  templateName: string;
  behavior: string;
  prefillSnapshot: Record<string, string> | null;
  sentAt: string;
  sentBy: string | null;
  viewedAt: string | null;
  viewedIp: string | null;
  signedDocumentId: string | null;
  template: EsignTemplateRow;
  fields: EsignLayoutField[];
};

export type SignTokenError =
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "unavailable" }
  | { kind: "template_missing" };

/**
 * Resolve a public `/sign/<token>` link to its request and template. Shared by
 * every `/api/sign/*` route so the token rules live in exactly one place.
 */
export async function resolveSignToken(
  admin: SupabaseClient,
  token: string,
  opts: { allowCompleted?: boolean } = {}
): Promise<{ ok: true; ctx: SignTokenContext } | { ok: false; error: SignTokenError }> {
  const { data } = await admin
    .from("esign_requests")
    .select(
      "id, client_id, template_id, template_name, behavior, status, signer_name, signer_email, cert_ref, token_expires_at, prefill_snapshot, sent_at, sent_by, viewed_at, viewed_ip, signed_document_id"
    )
    .eq("sign_token", token)
    .maybeSingle();

  if (!data) return { ok: false, error: { kind: "not_found" } };

  const expires = data.token_expires_at ? new Date(data.token_expires_at) : null;
  if (expires && expires.getTime() < Date.now()) {
    return { ok: false, error: { kind: "expired" } };
  }

  const terminal = ["superseded", "revoked"];
  if (!opts.allowCompleted) terminal.push("completed");
  if (terminal.includes(String(data.status))) {
    return { ok: false, error: { kind: "unavailable" } };
  }

  if (!data.template_id) {
    return { ok: false, error: { kind: "template_missing" } };
  }

  const { data: template } = await admin
    .from("esign_templates")
    .select(ESIGN_TEMPLATE_SELECT)
    .eq("id", data.template_id)
    .maybeSingle();

  if (!template) return { ok: false, error: { kind: "template_missing" } };

  const row = template as EsignTemplateRow;
  return {
    ok: true,
    ctx: {
      requestId: data.id as string,
      clientId: data.client_id as string,
      status: String(data.status),
      signerName: String(data.signer_name ?? ""),
      signerEmail: String(data.signer_email ?? ""),
      certRef: (data.cert_ref as string | null) ?? null,
      // Snapshots, so a renamed or deleted template cannot rewrite history.
      templateName: String(data.template_name ?? row.name),
      behavior: String(data.behavior ?? row.behavior),
      prefillSnapshot: (data.prefill_snapshot as Record<string, string> | null) ?? null,
      sentAt: String(data.sent_at ?? ""),
      sentBy: (data.sent_by as string | null) ?? null,
      viewedAt: (data.viewed_at as string | null) ?? null,
      viewedIp: (data.viewed_ip as string | null) ?? null,
      signedDocumentId: (data.signed_document_id as string | null) ?? null,
      template: row,
      fields: layoutFromTemplate(row.fields),
    },
  };
}

export function signTokenErrorResponse(error: SignTokenError): {
  message: string;
  status: number;
} {
  switch (error.kind) {
    case "expired":
      return { message: "Expired", status: 410 };
    case "unavailable":
      return { message: "Unavailable", status: 410 };
    case "template_missing":
      return { message: "This document is no longer available.", status: 410 };
    default:
      return { message: "Invalid link", status: 404 };
  }
}
