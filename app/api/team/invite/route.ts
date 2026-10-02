import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import type { UserRole } from "@/lib/types/user-role";

/** Roles that can be assigned through the invite dialog (admins only; dev is bulk/edit elsewhere). */
const INVITE_TARGETS = new Set<UserRole>(["admin", "acct_manager", "attorney"]);

function canInviteTarget(inviterRole: string, target: UserRole): boolean {
  if (!INVITE_TARGETS.has(target)) return false;
  if (inviterRole === "admin" || inviterRole === "dev") return true;
  return false;
}

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile, error: profErr } = await getProfileForUser(supabaseAuth, user);
    if (profErr) {
      console.error("[team/invite] profile fetch error:", profErr);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (profile.role !== "admin" && profile.role !== "dev") {
      return NextResponse.json(
        { error: "Only administrators and developers can invite team members." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { full_name, email, role } = body;

    if (!full_name || !email || !role) {
      return NextResponse.json(
        {
          error: `Missing fields: ${!full_name ? "full_name " : ""}${!email ? "email " : ""}${!role ? "role" : ""}`,
        },
        { status: 400 }
      );
    }

    if (!canInviteTarget(profile.role, role as UserRole)) {
      return NextResponse.json(
        { error: "You cannot assign this role." },
        { status: 403 }
      );
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Service role key not configured" },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const tempPassword = "ZB" + Math.floor(100000 + Math.random() * 900000);

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name, role },
      });

    if (authError) {
      console.error("[team/invite] auth create error:", authError.message);
      return NextResponse.json({ error: "Failed to create user account" }, { status: 400 });
    }

    if (!authData?.user) {
      return NextResponse.json(
        { error: "Could not create user" },
        { status: 400 }
      );
    }

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: authData.user.id,
      full_name: full_name,
      email: email,
      role: role as UserRole,
      is_active: true,
    });

    if (profileError) {
      console.error("[team/invite] profile insert error:", profileError.message);
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      tempPassword,
      email,
    });
  } catch (err) {
    console.error("[team/invite] unexpected error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
