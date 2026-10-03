import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isDevOrAdmin } from "@/lib/roles";
import { publicAppUrl } from "@/lib/constants/business-contact";

function appOrigin(): string {
  return publicAppUrl();
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile } = await getProfileForUser(supabase, user);
    if (!profile || !isDevOrAdmin(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { client_id?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const clientId = body.client_id?.trim();
    if (!clientId) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    const { data: row, error: findErr } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();

    if (findErr) {
      console.error("[send-invite] find client error:", findErr.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const token = randomBytes(32).toString("hex");

    const { error } = await supabase
      .from("clients")
      .update({ portal_invite_token: token })
      .eq("id", clientId);

    if (error) {
      console.error("[send-invite] update error:", error.message);
      return NextResponse.json(
        { error: "Failed to generate invite" },
        { status: 500 }
      );
    }

    const setupUrl = `${appOrigin()}/portal/setup?token=${encodeURIComponent(
      token
    )}`;

    return NextResponse.json({
      success: true,
      setupUrl,
      ok: true,
      invite_url: setupUrl,
    });
  } catch (err) {
    console.error("[send-invite] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
