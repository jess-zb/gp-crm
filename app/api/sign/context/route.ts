import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEsignFeatureEnabled } from "@/lib/esign/config";
import {
  loadEsignPrefill,
  mergeSignerOverrides,
  loadAdvisorOptions,
} from "@/lib/esign/load-prefill";
import { resolveSignToken, signTokenErrorResponse } from "@/lib/esign/resolve-request";

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
  const resolved = await resolveSignToken(admin, token);
  if (!resolved.ok) {
    const { message, status } = signTokenErrorResponse(resolved.error);
    return NextResponse.json({ error: message }, { status });
  }
  const { ctx } = resolved;

  const prefill = mergeSignerOverrides(
    await loadEsignPrefill(admin, ctx.clientId),
    ctx.prefillSnapshot
  );
  const advisorOptions = await loadAdvisorOptions(admin, "acct_manager");
  if (prefill.advisor && !advisorOptions.includes(prefill.advisor)) {
    advisorOptions.unshift(prefill.advisor);
  }

  return NextResponse.json({
    templateId: ctx.template.id,
    signerName: ctx.signerName,
    signerEmail: ctx.signerEmail,
    certRef: ctx.certRef,
    prefill,
    fields: ctx.fields,
    requiredBinds: ctx.template.required_binds ?? [],
    // The signer sees the MID their file is enrolled under; they never pick it.
    midOptions: prefill.mid ? [prefill.mid] : [],
    advisorOptions,
    title: ctx.templateName,
  });
}
