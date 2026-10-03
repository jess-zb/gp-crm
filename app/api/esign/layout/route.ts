import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canManageEsignTemplates, isEsignFeatureEnabled } from "@/lib/esign/config";
import { loadTemplateById } from "@/lib/esign/templates";
import { isEsignBindKey, parseLayoutFields } from "@/lib/esign/layout";

async function requireTemplateManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canManageEsignTemplates(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { supabase, user };
}

/** Field placements for one template. */
export async function GET(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }
  const gate = await requireTemplateManager();
  if (gate.error) return gate.error;

  const templateId = new URL(request.url).searchParams.get("templateId")?.trim() ?? "";
  if (!templateId) {
    return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
  }

  const template = await loadTemplateById(gate.supabase!, templateId);
  if (!template) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    templateId,
    name: template.name,
    fields: parseLayoutFields(template.fields) ?? [],
    requiredBinds: template.required_binds ?? [],
  });
}

export async function PUT(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }
  const gate = await requireTemplateManager();
  if (gate.error) return gate.error;

  let body: { templateId?: string; fields?: unknown; requiredBinds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const templateId = String(body.templateId ?? "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
  }

  const fields = parseLayoutFields(body.fields);
  if (!fields) return NextResponse.json({ error: "Invalid fields." }, { status: 400 });

  const requiredBinds = Array.isArray(body.requiredBinds)
    ? Array.from(
        new Set(
          body.requiredBinds
            .map((b) => String(b))
            .filter((b) => isEsignBindKey(b) && fields.some((f) => f.bind === b))
        )
      )
    : undefined;

  const admin = createAdminClient();
  const { error } = await admin
    .from("esign_templates")
    .update({
      fields,
      ...(requiredBinds ? { required_binds: requiredBinds } : {}),
    })
    .eq("id", templateId);

  if (error) {
    console.error("[esign layout]", error.message);
    return NextResponse.json(
      { error: "Could not save field placement." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, fields, requiredBinds });
}
