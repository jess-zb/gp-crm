import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canUsePostLogicApi } from "@/lib/roles";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile, error: profErr } = await getProfileForUser(supabase, user);
    if (profErr) {
      console.error("[postlogic/unique-id] profile fetch error:", profErr);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
    if (!profile || !canUsePostLogicApi(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { clientId?: unknown; postlogic_unique_id?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const clientId = String(body.clientId ?? "").trim();
    const raw = body.postlogic_unique_id;
    const postlogic_unique_id =
      raw == null || String(raw).trim() === "" ? null : String(raw).trim();

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const { data: row, error: fetchErr } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .not("fedex_batch_sent_at", "is", null)
      .is("fedex_tracking_number", null)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchErr) {
      console.error("[postlogic/unique-id] fetch client error:", fetchErr.message);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json(
        { error: "Client is not in the awaiting-tracking state." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("clients")
      .update({ postlogic_unique_id })
      .eq("id", clientId);

    if (error) {
      console.error("[postlogic/unique-id] update client error:", error.message);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[postlogic/unique-id] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
