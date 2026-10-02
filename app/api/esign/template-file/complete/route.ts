import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canUseEsignStaffUi, isEsignFeatureEnabled } from "@/lib/esign/config";
import { isUploadableEsignKind } from "@/lib/esign/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPdfMagicBytes } from "@/lib/clients/document-upload";
import {
  ESIGN_TEMPLATE_BUCKET,
  ESIGN_TEMPLATE_MAX_BYTES,
  isIncomingTemplatePath,
  storedTemplatePath,
} from "@/lib/esign/template-storage";

export const runtime = "nodejs";

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

  let body: { kind?: string; path?: string; fileSize?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const kind = String(body.kind ?? "").trim();
  const path = String(body.path ?? "").trim();
  const fileSize = Number(body.fileSize ?? 0);
  if (!isUploadableEsignKind(kind) || !isIncomingTemplatePath(user.id, kind, path)) {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!fileSize || fileSize > ESIGN_TEMPLATE_MAX_BYTES) {
    return NextResponse.json({ error: "PDF must be 8 MB or smaller." }, { status: 413 });
  }

  const admin = createAdminClient();
  const bucket = admin.storage.from(ESIGN_TEMPLATE_BUCKET);
  const { data, error } = await bucket.download(path);
  if (error || !data) {
    return NextResponse.json({ error: "Uploaded file was not found." }, { status: 400 });
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length > ESIGN_TEMPLATE_MAX_BYTES || !hasPdfMagicBytes(bytes)) {
    await bucket.remove([path]);
    return NextResponse.json({ error: "That file is not a PDF." }, { status: 400 });
  }

  const { error: saveErr } = await bucket.upload(storedTemplatePath(kind), bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  await bucket.remove([path]);
  if (saveErr) {
    return NextResponse.json({ error: saveErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
