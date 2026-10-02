import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canUseEsignStaffUi, opensignApiToken, templateIdForKind } from "@/lib/esign/config";
import { listOpensignTemplates } from "@/lib/esign/opensign-template";

/** Staff-only: list OpenSign templates so we can bind CC Auth + Welcome Packet IDs. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { profile } = await getProfileForUser(supabase, user);
  if (!profile || !canUseEsignStaffUi(profile.role, user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!opensignApiToken()) {
    return NextResponse.json({ error: "Missing OPENSIGN_API_TOKEN." }, { status: 400 });
  }

  try {
    const templates = await listOpensignTemplates();
    return NextResponse.json({
      ok: true,
      bound: {
        cc_authorization: templateIdForKind("cc_authorization"),
        welcome_packet: templateIdForKind("welcome_packet"),
      },
      templates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not list templates.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
