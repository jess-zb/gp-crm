import type { SupabaseClient } from "@supabase/supabase-js";
import { buildClientDocumentStoragePath } from "@/lib/clients/document-upload";
import {
  advanceClientAfterPoaUpload,
  isPoaDocumentType,
  markPoaSignedOnClient,
} from "@/lib/clients/poa-upload-advance";
import { documentTypeForKind, esignSignedFileStem, type EsignKind } from "./types";
import { queuePendingPrimaryFedex } from "@/lib/packets/queue-pending-fedex";

/** OpenSign webhook leftover — native complete uses persistCompletedEsignBytes. */
export async function persistCompletedEsign(_args: {
  admin: SupabaseClient;
  requestId: string;
  clientId: string;
  kind: EsignKind;
  signedFileUrl: string | null;
  certificateUrl: string | null;
}): Promise<{ signedId: string | null; certificateId: string | null }> {
  console.warn("[esign persist] OpenSign file URLs are no longer imported");
  return { signedId: null, certificateId: null };
}

const BUCKET = "client-documents";

async function storePdfBytes(args: {
  admin: SupabaseClient;
  clientId: string;
  fileName: string;
  documentType: string;
  notes: string;
  bytes: Uint8Array;
  uploadedBy?: string | null;
}): Promise<string | null> {
  const storagePath = buildClientDocumentStoragePath(args.clientId, args.fileName);
  const { error: upErr } = await args.admin.storage.from(BUCKET).upload(storagePath, args.bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) {
    console.error("[esign persist] storage", upErr.message);
    return null;
  }
  const { data, error } = await args.admin
    .from("documents")
    .insert({
      client_id: args.clientId,
      document_type: args.documentType,
      file_name: args.fileName,
      storage_path: storagePath,
      file_size_bytes: args.bytes.length,
      mime_type: "application/pdf",
      uploaded_by: args.uploadedBy ?? null,
      notes: args.notes,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[esign persist] documents insert", error?.message);
    await args.admin.storage.from(BUCKET).remove([storagePath]);
    return null;
  }
  return data.id as string;
}

export async function persistCompletedEsignBytes(args: {
  admin: SupabaseClient;
  requestId: string;
  clientId: string;
  kind: EsignKind;
  signedPdf: Uint8Array;
  sha256: string;
  uploadedBy?: string | null;
}): Promise<{ signedId: string | null; certificateId: string | null }> {
  const { data: existing } = await args.admin
    .from("esign_requests")
    .select("signed_document_id, sent_by")
    .eq("id", args.requestId)
    .maybeSingle();

  const { data: clientRow } = await args.admin
    .from("clients")
    .select("stage, fedex_queued_at")
    .eq("id", args.clientId)
    .maybeSingle();
  const stageBefore = (clientRow?.stage as string | null) ?? null;

  let signedId = (existing?.signed_document_id as string | null) ?? null;
  if (signedId) {
    const { data: stillThere } = await args.admin
      .from("documents")
      .select("id")
      .eq("id", signedId)
      .maybeSingle();
    if (!stillThere) signedId = null;
  }
  const uploadedBy =
    (typeof args.uploadedBy === "string" && args.uploadedBy.trim()) ||
    (existing?.sent_by as string | null) ||
    null;
  const documentType = documentTypeForKind(args.kind);
  const stamp = Date.now();
  const label = esignSignedFileStem(args.kind);

  if (!signedId) {
    signedId = await storePdfBytes({
      admin: args.admin,
      clientId: args.clientId,
      fileName: `${label}-signed-${stamp}.pdf`,
      documentType,
      notes: "CRM eSign signed copy with certificate of completion",
      bytes: args.signedPdf,
      uploadedBy,
    });
  } else if (uploadedBy) {
    await args.admin
      .from("documents")
      .update({ uploaded_by: uploadedBy })
      .eq("id", signedId)
      .is("uploaded_by", null);
  }

  const { error: reqErr } = await args.admin
    .from("esign_requests")
    .update({
      status: signedId ? "completed" : "signed",
      completed_at: signedId ? new Date().toISOString() : null,
      signed_document_id: signedId,
      certificate_document_id: signedId,
      document_sha256: args.sha256,
      last_error: signedId ? null : "Signed file could not be saved to Uploads.",
    })
    .eq("id", args.requestId);
  if (reqErr) {
    console.error("[esign persist] request update", reqErr.message);
  }

  if (signedId && isPoaDocumentType(documentType)) {
    await markPoaSignedOnClient(args.admin, args.clientId);
    const advanced = await advanceClientAfterPoaUpload(args.admin, args.clientId);
    if (advanced) {
      await args.admin.from("audit_log").insert({
        client_id: args.clientId,
        action: "stage_auto_advanced",
        new_value: {
          stage: "awaiting_collection_letter",
          trigger: "esign_welcome_packet_poa",
          from_stage: stageBefore,
          document_id: signedId,
        },
        performed_by_name: "System",
      });
    }
  }

  if (signedId && args.kind === "welcome_packet") {
    if (!clientRow?.fedex_queued_at) {
      await args.admin
        .from("clients")
        .update({
          delivery_method: "fedex",
          fedex_queued_at: new Date().toISOString(),
        })
        .eq("id", args.clientId);
    }
    const queued = await queuePendingPrimaryFedex(args.admin, args.clientId);
    if (queued === "inserted") {
      await args.admin.from("audit_log").insert({
        client_id: args.clientId,
        action: "welcome_packet_queued",
        new_value: {
          delivery_method: "fedex",
          source: "esign_signed",
          signed_document_id: signedId,
        },
        performed_by_name: "System",
      });
    }
  }

  return { signedId, certificateId: signedId };
}
