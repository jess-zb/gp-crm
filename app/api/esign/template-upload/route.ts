import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canManageEsignTemplates, isEsignFeatureEnabled } from "@/lib/esign/config";
import {
  ESIGN_TEMPLATE_BUCKET,
  ESIGN_TEMPLATE_MAX_BYTES,
  incomingTemplatePath,
} from "@/lib/esign/template-storage";

export const runtime = "nodejs";

/** Signed upload into the staging prefix. Leadership only. */
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
  if (!profile || !canManageEsignTemplates(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { fileName?: string; fileSize?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fileName = String(body.fileName ?? "").trim();
  const fileSize = Number(body.fileSize ?? 0);
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Upload a PDF." }, { status: 400 });
  }
  if (!fileSize || fileSize > ESIGN_TEMPLATE_MAX_BYTES) {
    return NextResponse.json({ error: "PDF must be 8 MB or smaller." }, { status: 413 });
  }

  const uploadToken = crypto.randomUUID();
  const path = incomingTemplatePath(user.id, uploadToken);
  const admin = createAdminClient();
  await admin.storage.from(ESIGN_TEMPLATE_BUCKET).remove([path]);
  const { data, error } = await admin.storage
    .from(ESIGN_TEMPLATE_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not start upload." },
      { status: 500 }
    );
  }

  return NextResponse.json({ path: data.path, token: data.token, uploadToken });
}
