import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEsignFeatureEnabled } from "@/lib/esign/config";
import { loadEsignPrefill, mergeSignerOverrides, loadAdvisorOptions } from "@/lib/esign/load-prefill";
import { loadEsignLayout } from "@/lib/esign/load-layout";
import { loadMerchantExtras, mergeMerchantOptions } from "@/lib/constants/merchants";
import { esignKindTitle, type EsignKind } from "@/lib/esign/types";

export async function POST(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = String(body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("esign_requests")
    .select("id, client_id, kind, status, signer_name, signer_email, cert_ref, token_expires_at, prefill_snapshot")
    .eq("sign_token", token)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  const expires = data.token_expires_at ? new Date(data.token_expires_at) : null;
  if (expires && expires.getTime() < Date.now()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }
  if (data.status === "superseded" || data.status === "revoked" || data.status === "completed") {
    return NextResponse.json({ error: "Unavailable" }, { status: 410 });
  }

  const live = await loadEsignPrefill(admin, data.client_id);
  const prefill = mergeSignerOverrides(
    live,
    (data.prefill_snapshot as Record<string, string> | null) ?? null
  );
  const kind = data.kind as EsignKind;
  const fields = await loadEsignLayout(admin, kind);
  const extras = await loadMerchantExtras(admin);
  const mids = mergeMerchantOptions([
    ...extras,
    ...(prefill.mid ? [prefill.mid] : []),
  ]);
  const advisorOptions = await loadAdvisorOptions(admin, "acct_manager");
  if (prefill.advisor && !advisorOptions.includes(prefill.advisor)) {
    advisorOptions.unshift(prefill.advisor);
  }
  return NextResponse.json({
    kind,
    signerName: data.signer_name,
    signerEmail: data.signer_email,
    certRef: data.cert_ref,
    prefill,
    fields,
    midOptions: mids,
    advisorOptions,
    title: esignKindTitle(kind),
  });
}
