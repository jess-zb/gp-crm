import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { loadPublicAttorneyBatch } from "@/lib/attorney-queue/public-batch";
import { isAttorneyBatchToken } from "@/lib/attorney-queue/tokens";
import { CLIENT_DOCUMENTS_BUCKET } from "@/lib/clients/document-storage";
import { normalizeUploadMimeType } from "@/lib/clients/document-upload";
import {
  resolveDownloadContentKind,
  resolveDownloadContentType,
  resolveDownloadFileName,
  sanitizeDownloadFileName,
} from "@/lib/clients/document-download";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

/**
 * Tokenized public download (no login).
 *
 * INVARIANT — see `.cursor/rules/attorney-queue-downloads.mdc`:
 * Stream via service-role storage.download() + no-store headers.
 * Do NOT fetch(signedUrl) from Vercel and do NOT redirect to signed URLs
 * (CDN-cached expired Location → InvalidJWT / "Could not fetch file").
 */
export async function GET(
  request: Request,
  context: { params: { token: string } }
) {
  try {
    const token = context.params.token?.trim() ?? "";
    if (!isAttorneyBatchToken(token)) {
      return NextResponse.json(
        { error: "Invalid link." },
        { status: 404, headers: NO_STORE }
      );
    }

    const { searchParams } = new URL(request.url);
    const documentId = String(searchParams.get("documentId") ?? "").trim();
    if (!documentId) {
      return NextResponse.json(
        { error: "Missing document." },
        { status: 400, headers: NO_STORE }
      );
    }

    const supabase = createServiceClient();
    const loaded = await loadPublicAttorneyBatch(supabase, token);
    if (!loaded.ok) {
      const status =
        loaded.reason === "expired" || loaded.reason === "revoked" ? 410 : 404;
      const error =
        loaded.reason === "expired"
          ? "This download link has expired."
          : loaded.reason === "revoked"
            ? "This download link was revoked."
            : "Invalid download link.";
      return NextResponse.json({ error }, { status, headers: NO_STORE });
    }

    const inBatch = loaded.batch.clients.some((c) =>
      c.documents.some((d) => d.id === documentId)
    );
    if (!inBatch) {
      return NextResponse.json(
        { error: "Document not in this batch." },
        { status: 404, headers: NO_STORE }
      );
    }

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("file_name, storage_path, mime_type")
      .eq("id", documentId)
      .maybeSingle();

    if (docErr || !doc?.storage_path) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404, headers: NO_STORE }
      );
    }

    // Prefer the JS client for storage.download — more reliable with service role
    // than createServerClient from @supabase/ssr in some serverless contexts.
    const storage = createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: file, error: dlErr } = await storage.storage
      .from(CLIENT_DOCUMENTS_BUCKET)
      .download(doc.storage_path as string);

    if (dlErr || !file) {
      console.error(
        "[attorney-batch download] storage.download:",
        dlErr?.message ?? "empty file"
      );
      return NextResponse.json(
        { error: "Could not fetch file." },
        { status: 502, headers: NO_STORE }
      );
    }

    const bytes = await file.arrayBuffer();
    const storedName = sanitizeDownloadFileName(String(doc.file_name ?? "file"));
    const storedMime = normalizeUploadMimeType(
      storedName,
      String(doc.mime_type ?? file.type ?? "application/octet-stream")
    );
    // Same PDF/TXT handling as CRM downloads — Shape text exports labeled .pdf
    // download as *.pdf.txt with text/plain so they open in a text editor.
    const contentKind = resolveDownloadContentKind(storedName, storedMime, bytes);
    const downloadName = resolveDownloadFileName(storedName, contentKind);
    const contentType = resolveDownloadContentType(contentKind, storedMime);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename="${downloadName}"`,
      },
    });
  } catch (err) {
    console.error(
      "[attorney-batch download]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500, headers: NO_STORE }
    );
  }
}
