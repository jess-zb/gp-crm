import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessClientRecord } from "@/lib/roles";
import { canUseEsignStaffUi, isEsignFeatureEnabled } from "@/lib/esign/config";
import { isEsignKind } from "@/lib/esign/types";
import { loadEsignPrefill, loadAdvisorOptions } from "@/lib/esign/load-prefill";
import { loadMerchantExtras, mergeMerchantOptions } from "@/lib/constants/merchants";

export async function GET(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId")?.trim() ?? "";
  const kindRaw = url.searchParams.get("kind") ?? "cc_authorization";
  if (!clientId || !isEsignKind(kindRaw)) {
    return NextResponse.json({ error: "Invalid client or document type." }, { status: 400 });
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

  const { data: client } = await supabase
    .from("clients")
    .select("id, assigned_to, attorney_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || !canAccessClientRecord(profile.role, user.id, client)) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const prefill = await loadEsignPrefill(createAdminClient(), clientId);
  const advisorOptions = await loadAdvisorOptions(createAdminClient(), profile.role);
  if (prefill.advisor && !advisorOptions.includes(prefill.advisor)) {
    advisorOptions.unshift(prefill.advisor);
  }
  const extras = await loadMerchantExtras(supabase);
  const midOptions = mergeMerchantOptions([
    ...extras,
    ...(prefill.mid ? [prefill.mid] : []),
  ]);
  return NextResponse.json({ kind: kindRaw, prefill, midOptions, advisorOptions });
}
