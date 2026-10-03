import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canManageEsignTemplates, isEsignFeatureEnabled } from "@/lib/esign/config";
import { loadTemplateById } from "@/lib/esign/templates";
import { readEsignTemplateFile } from "@/lib/esign/template-storage";

export const runtime = "nodejs";

/** The blank template PDF, for the field-placement editor. */
export async function GET(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const templateId = new URL(request.url).searchParams.get("templateId")?.trim() ?? "";
  if (!templateId) {
    return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
  }

  const template = await loadTemplateById(supabase, templateId);
  if (!template) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const bytes = await readEsignTemplateFile(template.storage_path);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[esign template-pdf]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Template PDF is missing." }, { status: 404 });
  }
}
