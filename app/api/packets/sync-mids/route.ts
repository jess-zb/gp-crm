import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canExportPacketsNeeded } from "@/lib/roles";
import { syncPacketsNeededMids } from "@/lib/packets/sync-packet-mids";
import { toUserFacingError } from "@/lib/user-facing-error";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { profile } = await getProfileForUser(supabase, user);
    if (!profile || !canExportPacketsNeeded(profile.role, user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { updated, total, error: syncError } = await syncPacketsNeededMids(admin);

    if (syncError) {
      return NextResponse.json({ error: syncError }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      updated,
      total,
      missing: total,
    });
  } catch (err) {
    console.error("[api/packets/sync-mids]", err);
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
