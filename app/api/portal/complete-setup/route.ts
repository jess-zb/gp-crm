import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isHexPortalInviteToken } from "@/lib/portal-invite-token";

const MIN_PASSWORD = 8;

export async function POST(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    let body: { token?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const token = body.token?.trim() ?? "";
    const password = body.password ?? "";
    if (!token || !isHexPortalInviteToken(token)) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD} characters` },
        { status: 400 }
      );
    }

    const admin = createServiceClient();

    const { data: client, error: fetchErr } = await admin
      .from("clients")
      .select("id, email, first_name, last_name")
      .eq("portal_invite_token", token)
      .maybeSingle();

    if (fetchErr) {
      console.error("[portal/complete-setup] fetch client error:", fetchErr.message);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    if (!client) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 400 }
      );
    }

    const row = client as {
      id: string;
      email: string | null;
      first_name: string;
      last_name: string;
    };

    const email = row.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "No email on file for this client. Contact your case manager." },
        { status: 400 }
      );
    }

    const { data: existingProfile, error: profFetchErr } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .eq("role", "client")
      .maybeSingle();

    if (profFetchErr) {
      console.error("[portal/complete-setup] fetch profile error:", profFetchErr.message);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    if (existingProfile?.id) {
      return NextResponse.json(
        { error: "An account already exists for this client. Sign in instead." },
        { status: 409 }
      );
    }

    const fullName = `${row.first_name} ${row.last_name}`.trim() || email;

    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "client",
        },
      });

    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "Could not create account";
      if (
        msg.toLowerCase().includes("already been registered") ||
        msg.toLowerCase().includes("already exists")
      ) {
        return NextResponse.json(
          {
            error:
              "This email is already registered. Sign in with your existing password or contact support.",
          },
          { status: 409 }
        );
      }
      console.error("[portal/complete-setup] createUser error:", msg);
      return NextResponse.json({ error: "Failed to create account" }, { status: 400 });
    }

    const userId = created.user.id;

    const { error: profileErr } = await admin.from("profiles").insert({
      id: userId,
      email,
      full_name: fullName,
      role: "client",
      is_active: true,
    });

    if (profileErr) {
      console.error("[portal/complete-setup] profile insert error:", profileErr.message);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    const { error: clearTokErr } = await admin
      .from("clients")
      .update({ portal_invite_token: null })
      .eq("id", row.id);

    if (clearTokErr) {
      console.error("[portal/complete-setup] clear token error:", clearTokErr.message);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Something went wrong" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, email });
  } catch (err) {
    console.error("[portal/complete-setup] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
