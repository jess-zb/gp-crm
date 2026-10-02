import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEsignFeatureEnabled } from "@/lib/esign/config";
import { loadEsignPrefill, mergeSignerOverrides } from "@/lib/esign/load-prefill";
import { loadEsignLayout } from "@/lib/esign/load-layout";
import { flattenSignedPdf } from "@/lib/esign/flatten-signed-pdf";
import type { EsignKind } from "@/lib/esign/types";

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
    const { data } = await admin
      .from("esign_requests")
      .select("client_id, kind, status, token_expires_at, prefill_snapshot")
      .eq("sign_token", token)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
    const expires = data.token_expires_at ? new Date(data.token_expires_at) : null;
    if (expires && expires.getTime() < Date.now()) {
      return NextResponse.json({ error: "Expired" }, { status: 410 });
    }
    if (data.status === "superseded" || data.status === "revoked") {
      return NextResponse.json({ error: "Unavailable" }, { status: 410 });
    }

    const kind = data.kind as EsignKind;
    const prefill = mergeSignerOverrides(
      await loadEsignPrefill(admin, data.client_id),
      (data.prefill_snapshot as Record<string, string> | null) ?? null
    );
    const fields = await loadEsignLayout(admin, kind);
    const bytes = await flattenSignedPdf({
      kind,
      prefill,
      fields,
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
