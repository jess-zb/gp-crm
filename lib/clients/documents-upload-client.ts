import { createClient } from "@/lib/supabase/client";
import { normalizeUploadMimeType } from "@/lib/clients/document-upload";

const BUCKET = "client-documents";

export type UploadedDocumentRow = {
  id: string;
  file_name: string;
  mime_type: string | null;
  document_type: string;
  created_at: string | null;
  uploaded_by: string | null;
  file_size_bytes: number | null;
  storage_path: string;
  notes: string | null;
  is_collection_letter?: boolean | null;
};

export type UploadClientDocumentResult = {
  document: UploadedDocumentRow;
  warning?: string;
  successMessage?: string;
  clientPatch?: {
    stage?: string | null;
    poaSignedAt?: string | null;
    hasPoaDocument?: boolean;
    hasCcAuthorization?: boolean;
  };
};

async function parseJsonOrThrow(res: Response, fallback: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (res.status === 413) {
      throw new Error("File is too large to upload. Please use a smaller file and try again.");
    }
    throw new Error(text.trim().slice(0, 200) || fallback);
  }
}

/**
 * Uploads a client document directly from the browser to Supabase Storage,
 * bypassing the Vercel request body limit. Flow:
 *   1) POST /api/clients/documents/upload-init → signed upload URL
 *   2) supabase-js uploads the file straight to Storage
 *   3) POST /api/clients/documents/upload-complete → records the DB row
 * Consumers still pass a FormData with the same fields as before.
 */
export async function uploadClientDocument(
  formData: FormData
): Promise<UploadClientDocumentResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Missing file.");
  }
  const clientId = String(formData.get("clientId") ?? "");
  const documentType = String(formData.get("documentType") ?? "upload");
  const notes = String(formData.get("notes") ?? "");
  const clientCardIdRaw = formData.get("clientCardId");
  const clientCardId =
    typeof clientCardIdRaw === "string" && clientCardIdRaw ? clientCardIdRaw : undefined;

  if (!clientId) {
    throw new Error("Missing client.");
  }

  const mimeType = normalizeUploadMimeType(file.name, file.type || "application/octet-stream");

  const initRes = await fetch("/api/clients/documents/upload-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    }),
  });
  const initJson = await parseJsonOrThrow(
    initRes,
    "Could not start upload. Please try again."
  );
  if (!initRes.ok) {
    throw new Error(String(initJson.error ?? "Could not start upload"));
  }
  const path = String(initJson.path ?? "");
  const token = String(initJson.token ?? "");
  if (!path || !token) {
    throw new Error("Upload session invalid — please try again.");
  }

  const supabase = createClient();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, file, {
      contentType: mimeType,
      upsert: false,
    });
  if (uploadErr) {
    if (uploadErr.message.includes("already exists")) {
      throw new Error(
        "A file with this name already exists. Rename the file and try again."
      );
    }
    throw new Error(uploadErr.message || "Upload to storage failed");
  }

  const completeRes = await fetch("/api/clients/documents/upload-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId,
      storagePath: path,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      documentType,
      notes,
      clientCardId,
    }),
  });
  const completeJson = await parseJsonOrThrow(
    completeRes,
    "Upload completed but the server returned an unexpected response."
  );
  if (!completeRes.ok || !completeJson.document) {
    throw new Error(String(completeJson.error ?? "Upload failed"));
  }

  return {
    document: completeJson.document as UploadedDocumentRow,
    warning: completeJson.warning as string | undefined,
    successMessage: completeJson.successMessage as string | undefined,
    clientPatch: completeJson.clientPatch as UploadClientDocumentResult["clientPatch"],
  };
}
