import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessClientRecord } from "@/lib/roles";
import {
  advanceClientAfterPoaUpload,
  isPoaDocumentType,
  markPoaSignedOnClient,
  poaAdvanceAlreadyApplied,
  POA_STAGE_ADVANCE_TOAST,
  shouldAttemptPoaAdvance,
} from "@/lib/clients/poa-upload-advance";
import { runCaseSentToAttorneysTriggers } from "@/lib/clients/case-sent-triggers";
import { normalizeUploadMimeType } from "@/lib/clients/document-upload";

const BUCKET = "client-documents";

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile } = await getProfileForUser(supabase, user);
    if (!profile || profile.role === "client") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: {
      clientId?: string;
      storagePath?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      documentType?: string;
      notes?: string;
      clientCardId?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const clientId = String(body.clientId ?? "");
    const storagePath = String(body.storagePath ?? "");
    const fileName = String(body.fileName ?? "");
    const fileSize = Number(body.fileSize ?? 0);
    const mimeType = normalizeUploadMimeType(
      fileName,
      String(body.mimeType ?? "application/octet-stream")
    );
    const documentType =
      body.documentType && body.documentType.trim() ? body.documentType.trim() : "upload";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const clientCardId =
      typeof body.clientCardId === "string" && body.clientCardId ? body.clientCardId : null;

    if (!clientId || !storagePath || !fileName) {
      return NextResponse.json(
        { error: "Missing clientId, storagePath, or fileName" },
        { status: 400 }
      );
    }

    if (!storagePath.startsWith(`clients/${clientId}/`)) {
      return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
    }

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("assigned_to, attorney_id, stage")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr || !clientRow) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!canAccessClientRecord(profile.role, user.id, clientRow)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (clientCardId) {
      const { data: cardRow } = await supabase
        .from("client_cards")
        .select("id, client_id")
        .eq("id", clientCardId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (!cardRow) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }
    }

    const storageClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Verify the object was actually uploaded to Storage before recording it
    const dir = storagePath.substring(0, storagePath.lastIndexOf("/"));
    const objectName = storagePath.substring(storagePath.lastIndexOf("/") + 1);
    const { data: listed, error: listErr } = await storageClient.storage
      .from(BUCKET)
      .list(dir, { search: objectName, limit: 1 });
    if (listErr || !listed?.length) {
      return NextResponse.json(
        { error: "Uploaded file not found in storage. Try again." },
        { status: 400 }
      );
    }

    const isCollection = documentType === "collection_letter";

    const insertPayload = {
      client_id: clientId,
      document_type: documentType,
      file_name: fileName,
      storage_path: storagePath,
      file_size_bytes: fileSize || null,
      mime_type: mimeType,
      uploaded_by: user.id,
      notes: notes || null,
      is_collection_letter: isCollection,
    };

    const { data: document, error: dbError } = await supabase
      .from("documents")
      .insert(insertPayload)
      .select(
        "id, file_name, mime_type, document_type, created_at, uploaded_by, file_size_bytes, storage_path, notes, is_collection_letter"
      )
      .single();

    if (dbError || !document) {
      console.error("Document insert failed:", dbError?.message);
      await storageClient.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "Failed to record document" }, { status: 400 });
    }

    let cardLinkWarning: string | null = null;
    if (clientCardId) {
      const { error: cardErr } = await supabase
        .from("client_cards")
        .update({ collection_letter_doc_id: document.id })
        .eq("id", clientCardId)
        .eq("client_id", clientId);
      if (cardErr) {
        cardLinkWarning = cardErr.message;
      }
    }

    let successMessage: string | undefined;
    let clientPatch:
      | { stage: string | null; poaSignedAt: string | null; hasPoaDocument: boolean }
      | undefined;

    if (isPoaDocumentType(documentType)) {
      await markPoaSignedOnClient(supabase, clientId);
      const stageBefore = String(clientRow.stage ?? "");
      const { data: afterMark } = await supabase
        .from("clients")
        .select("stage, poa_signed_at")
        .eq("id", clientId)
        .maybeSingle();
      let stageNow = String(afterMark?.stage ?? stageBefore);
      const poaSignedAt = (afterMark?.poa_signed_at as string | null) ?? null;

      // Trigger already advanced during INSERT — do not update/audit again.
      if (poaAdvanceAlreadyApplied(stageBefore, stageNow)) {
        successMessage = POA_STAGE_ADVANCE_TOAST;
      } else if (shouldAttemptPoaAdvance(stageNow)) {
        const advanced = await advanceClientAfterPoaUpload(supabase, clientId);
        if (advanced) {
          stageNow = "awaiting_collection_letter";
          successMessage = POA_STAGE_ADVANCE_TOAST;
          await supabase.from("audit_log").insert({
            client_id: clientId,
            action: "stage_auto_advanced",
            new_value: {
              stage: "awaiting_collection_letter",
              trigger: "poa_document_uploaded",
              from_stage: stageBefore,
              document_id: document.id,
            },
            performed_by_name: "System",
          });
        }
      }

      clientPatch = {
        stage: stageNow,
        poaSignedAt,
        hasPoaDocument: true,
      };
    }

    if (isCollection) {
      const nowIso = new Date().toISOString();
      const { data: stageRow } = await supabase
        .from("clients")
        .select("stage")
        .eq("id", clientId)
        .maybeSingle();
      const stageNow = (stageRow?.stage as string | undefined) ?? "";
      if (stageNow !== "case_sent_to_attorneys" && stageNow !== "closed") {
        await storageClient
          .from("clients")
          .update({
            stage: "case_sent_to_attorneys",
            collection_letter_received_at: nowIso,
            case_sent_to_attorney_at: nowIso,
            stage_entered_at: nowIso,
          })
          .eq("id", clientId);
        await supabase.from("audit_log").insert({
          client_id: clientId,
          action: "stage_auto_advanced",
          new_value: {
            stage: "case_sent_to_attorneys",
            trigger: "collection_letter_upload_app",
            document_id: document.id,
          },
          performed_by_name: "System",
        });
      }

      try {
        const triggerResult = await runCaseSentToAttorneysTriggers({
          clientId,
          performerId: user.id,
          source: "collection_letter_upload",
        });
        // Attorney Resend emails are disabled; do not mark notify error on skip.
        // In-app attorney alerts fire when staff sends an Attorney Queue batch.
        if (document?.id && triggerResult.emailSent) {
          const { error: docUpErr } = await supabase
            .from("documents")
            .update({
              attorney_notified_at: new Date().toISOString(),
              attorney_notify_error: null,
            })
            .eq("id", document.id)
            .eq("client_id", clientId);
          if (docUpErr) {
            console.warn("[upload-complete] attorney_notified_at:", docUpErr.message);
          }
        }
      } catch (err) {
        console.warn(
          "[upload-complete] case_sent triggers:",
          err instanceof Error ? err.message : err
        );
      }
    }

    console.info(
      `[perf] upload-complete ${Date.now() - startedAt}ms type=${documentType}`
    );
    return NextResponse.json({
      document,
      ...(cardLinkWarning ? { warning: cardLinkWarning } : {}),
      ...(successMessage ? { successMessage } : {}),
      ...(clientPatch ? { clientPatch } : {}),
    });
  } catch (err) {
    console.error("[upload-complete] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
