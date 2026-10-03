import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessClientRecord } from "@/lib/roles";
import { canUseEsignStaffUi, isEsignFeatureEnabled } from "@/lib/esign/config";
import { loadEsignPrefill, loadAdvisorOptions } from "@/lib/esign/load-prefill";
import { loadTemplateById, templateBelongsToClient } from "@/lib/esign/templates";
import { reviewFieldsForTemplate } from "@/lib/esign/review-fields";

export async function GET(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canUseEsignStaffUi(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId")?.trim() ?? "";
  const templateId = url.searchParams.get("templateId")?.trim() ?? "";
  if (!clientId || !templateId) {
    return NextResponse.json({ error: "Missing client or document." }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, assigned_to, attorney_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!canAccessClientRecord(profile.role, user.id, client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await templateBelongsToClient(supabase, templateId, clientId))) {
    return NextResponse.json(
      { error: "That document does not belong to this client's MID." },
      { status: 400 }
    );
  }

  const template = await loadTemplateById(supabase, templateId);
  if (!template) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const prefill = await loadEsignPrefill(admin, clientId);
  const advisorOptions = await loadAdvisorOptions(admin, profile.role);
  if (prefill.advisor && !advisorOptions.includes(prefill.advisor)) {
    advisorOptions.unshift(prefill.advisor);
  }

  return NextResponse.json({
    ok: true,
    templateId,
    templateName: template.name,
    behavior: template.behavior,
    reviewFields: reviewFieldsForTemplate(template),
    fields: template.fields,
    requiredBinds: template.required_binds ?? [],
    prefill,
    advisorOptions,
  });
}
