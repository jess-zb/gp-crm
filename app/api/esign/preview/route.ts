import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessClientRecord } from "@/lib/roles";
import { canUseEsignStaffUi, isEsignFeatureEnabled } from "@/lib/esign/config";
import { loadTemplateById, templateBelongsToClient } from "@/lib/esign/templates";
import { flattenSignedPdf } from "@/lib/esign/flatten-signed-pdf";
import { parseLayoutFields } from "@/lib/esign/layout";
import type { EsignClientPrefill } from "@/lib/esign/map-client-prefill";

export const runtime = "nodejs";
export const maxDuration = 60;

const PREFILL_KEYS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "street",
  "city",
  "state",
  "zip",
  "dateOfBirth",
  "spouseName",
  "advisor",
  "mid",
  "amountAuthorized",
  "card1Last4",
  "card1Amount",
  "card2Last4",
  "card2Amount",
  "card3Last4",
  "card3Amount",
  "card4Last4",
  "card4Amount",
  "card5Last4",
  "card5Amount",
] as const;

function prefillFromBody(raw: unknown): EsignClientPrefill {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = {} as EsignClientPrefill;
  for (const key of PREFILL_KEYS) {
    const value = src[key];
    out[key] = typeof value === "string" ? value : "";
  }
  return out;
}

/**
 * Live staff preview of the same flattened PDF the client sees on /sign.
 * Field positions come from the saved template, not from the request.
 * This route never sends the document.
 */
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
  if (!profile || !canUseEsignStaffUi(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { clientId?: string; templateId?: string; prefill?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = body.clientId?.trim() ?? "";
  const templateId = body.templateId?.trim() ?? "";
  if (!clientId || !templateId) {
    return NextResponse.json({ error: "Missing client or document." }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, assigned_to, attorney_id, mid_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!canAccessClientRecord(profile.role, user.id, client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!client.mid_id) {
    return NextResponse.json({ error: "Assign a MID before previewing this document." }, { status: 400 });
  }

  const allowed = await templateBelongsToClient(supabase, templateId, clientId);
  if (!allowed) {
    return NextResponse.json({ error: "This document is not for the client's MID." }, { status: 403 });
  }

  const template = await loadTemplateById(supabase, templateId);
  if (!template) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  try {
    const bytes = await flattenSignedPdf({
      storagePath: template.storage_path,
      prefill: prefillFromBody(body.prefill),
      fields: parseLayoutFields(template.fields) ?? [],
      signedDate: "",
    });
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[esign preview]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load the document." }, { status: 500 });
  }
}
