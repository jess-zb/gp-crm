import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canManageEsignTemplates, isEsignFeatureEnabled } from "@/lib/esign/config";
import { loadTemplateById } from "@/lib/esign/templates";
import { loadMidById } from "@/lib/mids/queries";
import { EsignLayoutEditorClient } from "./EsignLayoutEditorClient";

export default async function EsignTemplateEditorPage({
  params,
}: {
  params: Promise<{ templateId: string }> | { templateId: string };
}) {
  if (!isEsignFeatureEnabled()) notFound();
  const resolved = await Promise.resolve(params);
  const templateId = resolved.templateId?.trim() ?? "";
  if (!templateId) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canManageEsignTemplates(profile.role)) notFound();

  const template = await loadTemplateById(supabase, templateId);
  if (!template) notFound();
  const mid = await loadMidById(supabase, template.mid_id);

  return (
    <EsignLayoutEditorClient
      templateId={template.id}
      templateName={template.name}
      midName={mid?.name ?? "MID"}
      backHref={`/settings/mids/${template.mid_id}`}
    />
  );
}
