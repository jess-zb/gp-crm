import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEsignFeatureEnabled } from "@/lib/esign/config";
import { loadEsignPrefill, mergeSignerOverrides } from "@/lib/esign/load-prefill";
import { flattenSignedPdf } from "@/lib/esign/flatten-signed-pdf";
import { resolveSignToken, signTokenErrorResponse } from "@/lib/esign/resolve-request";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  try {
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
    const bytes = await flattenSignedPdf({
      storagePath: ctx.template.storage_path,
      prefill,
      fields: ctx.fields,
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
    console.error("[esign pdf]", err);
    return NextResponse.json(
      { error: "Could not load the document. Please try again." },
      { status: 500 }
    );
  }
}
