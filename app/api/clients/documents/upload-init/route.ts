import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessClientRecord } from "@/lib/roles";
import {
  buildClientDocumentStoragePath,
  isAllowedUploadFile,
  normalizeUploadMimeType,
} from "@/lib/clients/document-upload";

const BUCKET = "client-documents";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB — large enough for recorded client calls

export async function POST(request: Request) {
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
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const clientId = String(body.clientId ?? "");
    const fileName = String(body.fileName ?? "");
    const fileSize = Number(body.fileSize ?? 0);
    const mimeType = normalizeUploadMimeType(fileName, String(body.mimeType ?? "application/octet-stream"));

    if (!clientId || !fileName || !fileSize) {
      return NextResponse.json(
        { error: "Missing clientId, fileName, or fileSize" },
        { status: 400 }
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File is too large. Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
        { status: 413 }
      );
    }

    if (!isAllowedUploadFile({ type: mimeType, name: fileName })) {
      return NextResponse.json(
        {
          error:
            "File type not supported. Use PDF, TXT, images, audio (MP3/WAV/M4A), video, or Word documents.",
        },
        { status: 400 }
      );
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

    const path = buildClientDocumentStoragePath(clientId, fileName);

    const storageClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data, error } = await storageClient.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create upload URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      path: data.path,
      token: data.token,
    });
  } catch (err) {
    console.error("[upload-init] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
