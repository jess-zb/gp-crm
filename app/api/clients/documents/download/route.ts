import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessClientRecord } from "@/lib/roles";
import {
  CLIENT_DOCUMENTS_BUCKET,
} from "@/lib/clients/document-storage";
import { normalizeUploadMimeType } from "@/lib/clients/document-upload";
import {
  resolveDownloadContentKind,
  resolveDownloadContentType,
  resolveDownloadFileName,
  sanitizeDownloadFileName,
} from "@/lib/clients/document-download";

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Staff / attorney document download — stream raw bytes via service-role storage.
 * Works for real PDFs, Shape text exports labeled .pdf, txt, audio, etc.
 *
 * `inline=1` — Content-Disposition: inline for preview (iframe / DocPreviewModal).
 * Default — attachment (save to disk), with Shape text-as-PDF renamed to *.pdf.txt.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = String(searchParams.get("documentId") ?? "");
    const inline = searchParams.get("inline") === "1";
    if (!documentId) {
      return NextResponse.json({ error: "Missing document" }, { status: 400, headers: NO_STORE });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }

    const { profile } = await getProfileForUser(supabase, user);
    if (!profile || profile.role === "client") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
    }

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("client_id, file_name, storage_path, mime_type")
      .eq("id", documentId)
      .is("archived_at", null)
      .maybeSingle();

    if (docErr || !doc?.storage_path) {
      if (docErr) console.error("[download] fetch doc error:", docErr.message);
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    }

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("assigned_to, attorney_id")
      .eq("id", doc.client_id)
      .maybeSingle();

    if (clientErr || !clientRow) {
      if (clientErr) console.error("[download] fetch client error:", clientErr.message);
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    }

    if (!canAccessClientRecord(profile.role, user.id, clientRow)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
    }

    const storage = createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: file, error: dlErr } = await storage.storage
      .from(CLIENT_DOCUMENTS_BUCKET)
      .download(doc.storage_path as string);

    if (dlErr || !file) {
      console.error("[download] storage.download:", dlErr?.message ?? "empty file");
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
    const contentKind = resolveDownloadContentKind(storedName, storedMime, bytes);
    const downloadName = resolveDownloadFileName(storedName, contentKind);
    // Preview needs the true media type (e.g. application/pdf for iframe).
    // Downloads use text/plain for Shape text-as-PDF so the OS opens a text editor.
    const contentType = inline
      ? contentKind === "text_as_pdf" || contentKind === "text"
        ? "text/plain; charset=utf-8"
        : storedMime
      : resolveDownloadContentType(contentKind, storedMime);
    const disposition = inline ? "inline" : "attachment";
    const dispositionName = inline ? storedName : downloadName;

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${disposition}; filename="${dispositionName}"`,
      },
    });
  } catch (err) {
    console.error("[download] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500, headers: NO_STORE }
    );
  }
}
