import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canManageEsignTemplates, isEsignFeatureEnabled } from "@/lib/esign/config";
import { loadTemplateById } from "@/lib/esign/templates";
import { suggestFieldsFromPdf } from "@/lib/esign/suggest-template-fields";
import { readEsignTemplateFile } from "@/lib/esign/template-storage";

export const runtime = "nodejs";

/** Re-scan a saved template for general labels. Does not write the placement. */
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

  let body: { templateId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const templateId = String(body.templateId ?? "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
  }

  const template = await loadTemplateById(supabase, templateId);
  if (!template) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readEsignTemplateFile(template.storage_path);
  } catch {
    return NextResponse.json({ error: "That PDF could not be read." }, { status: 400 });
  }

  const fields = await suggestFieldsFromPdf(bytes);
  return NextResponse.json({ ok: true, fields });
}
