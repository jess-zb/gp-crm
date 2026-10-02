import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canPlaceEsignFields, isEsignFeatureEnabled } from "@/lib/esign/config";
import { isEsignKind } from "@/lib/esign/types";
import { readEsignTemplateFile } from "@/lib/esign/template-files";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isEsignFeatureEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  const kindRaw = new URL(request.url).searchParams.get("kind") ?? "";
  if (!isEsignKind(kindRaw)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  const bytes = await readEsignTemplateFile(kindRaw);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
    },
  });
}
