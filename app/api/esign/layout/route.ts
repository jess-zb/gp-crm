import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canPlaceEsignFields, isEsignFeatureEnabled } from "@/lib/esign/config";
import { isEsignKind } from "@/lib/esign/types";
import { loadEsignLayout } from "@/lib/esign/load-layout";
import { parseLayoutFields } from "@/lib/esign/layout";

export async function GET(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }
  const kindRaw = new URL(request.url).searchParams.get("kind") ?? "";
  if (!isEsignKind(kindRaw)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canPlaceEsignFields(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const fields = await loadEsignLayout(createAdminClient(), kindRaw);
  return NextResponse.json({ kind: kindRaw, fields });
}

export async function PUT(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "E-Sign is not enabled." }, { status: 404 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canPlaceEsignFields(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { kind?: string; fields?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isEsignKind(String(body.kind ?? ""))) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  const fields = parseLayoutFields(body.fields);
  if (!fields) return NextResponse.json({ error: "Invalid fields." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("esign_layouts").upsert({
    kind: body.kind,
    fields,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) {
    console.error("[esign layout]", error.message);
    return NextResponse.json({ error: "Could not save field placement." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, fields });
}
