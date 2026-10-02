import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canExportPacketsNeeded } from "@/lib/roles";
import { toUserFacingError } from "@/lib/user-facing-error";

export async function POST(req: Request) {
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

    const body = (await req.json()) as { clientId?: unknown };
    const clientId =
      typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const performerName = profile.full_name ?? user.email ?? null;

    const { error: auditErr } = await admin.from("audit_log").insert({
      client_id: clientId,
      action: "fedex_secondary_declined",
      new_value: { reason: "skipped_by_staff" },
      performed_by: user.id,
      performed_by_name: performerName,
    });
    if (auditErr) {
      return NextResponse.json(
        { error: toUserFacingError(auditErr.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/packets/skip-secondary]", err);
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
