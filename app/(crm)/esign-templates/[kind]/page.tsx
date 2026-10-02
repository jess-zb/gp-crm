import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isEsignKind } from "@/lib/esign/types";
import { canPlaceEsignFields, isEsignFeatureEnabled } from "@/lib/esign/config";
import { EsignLayoutEditorClient } from "./EsignLayoutEditorClient";

export default async function EsignTemplateEditorPage({
  params,
}: {
  params: Promise<{ kind: string }> | { kind: string };
}) {
  if (!isEsignFeatureEnabled()) notFound();
  const resolved = await Promise.resolve(params);
  const kind = resolved.kind;
  if (!isEsignKind(kind)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canPlaceEsignFields(profile.role)) notFound();

  return <EsignLayoutEditorClient kind={kind} />;
}
