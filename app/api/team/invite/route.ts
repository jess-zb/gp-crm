import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

function makeTempPassword(): string {
  return "ZB" + Math.floor(100000 + Math.random() * 900000);
}

function isAlreadyRegistered(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("already") && (m.includes("registered") || m.includes("exists"));
}

/**
 * `handle_new_user` inserts the profile when auth.users is created. A second
 * insert hits profiles_pkey and used to fail the request after the account
 * existed, so the temporary password never reached the dialog.
 */
async function syncStaffProfile(
  adminClient: SupabaseClient,
  row: { id: string; full_name: string; email: string; role: UserRole }
) {
  return adminClient.from("profiles").upsert(
    {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      role: row.role,
      is_active: true,
    },
    { onConflict: "id" }
  );
}

/**
 * The first invite can create the auth user and then fail before the dialog
 * shows the password. A retry hits "already registered". Issue a new temporary
 * password for that staff account so the admin still gets login credentials.
 */
async function issuePasswordForExistingStaff(
  adminClient: SupabaseClient,
  args: {
    email: string;
    full_name: string;
    role: UserRole;
    tempPassword: string;
    inviterRole: string;
  }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: existing, error: lookupErr } = await adminClient
    .from("profiles")
    .select("id, role")
    .ilike("email", args.email)
    .maybeSingle();

  if (lookupErr) {
    console.error("[team/invite] existing profile lookup:", lookupErr.message);
    return { ok: false, error: "This email is already registered.", status: 409 };
  }
  if (!existing) {
    return { ok: false, error: "This email is already registered.", status: 409 };
  }
  if (existing.role === "client") {
    return {
      ok: false,
      error: "This email already belongs to a client portal account.",
      status: 409,
    };
  }
  if (existing.role === "dev" && args.inviterRole !== "dev") {
    return { ok: false, error: "You cannot assign this role.", status: 403 };
  }

  const { error: updateErr } = await adminClient.auth.admin.updateUserById(existing.id, {
    password: args.tempPassword,
    email_confirm: true,
    user_metadata: { full_name: args.full_name, role: args.role },
  });
  if (updateErr) {
    console.error("[team/invite] password reissue error:", updateErr.message);
    return { ok: false, error: "Failed to create user account", status: 400 };
  }

  const { error: profileError } = await syncStaffProfile(adminClient, {
    id: existing.id,
    full_name: args.full_name,
    email: args.email,
    role: args.role,
  });
  if (profileError) {
    console.error("[team/invite] profile sync error:", profileError.message);
  }

  return { ok: true };
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
    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role;

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
    const tempPassword = makeTempPassword();
    const targetRole = role as UserRole;

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name, role: targetRole },
      });

    if (authError) {
      console.error("[team/invite] auth create error:", authError.message);
      if (!isAlreadyRegistered(authError.message)) {
        return NextResponse.json({ error: "Failed to create user account" }, { status: 400 });
      }

      const issued = await issuePasswordForExistingStaff(adminClient, {
        email,
        full_name,
        role: targetRole,
        tempPassword,
        inviterRole: profile.role,
      });
      if (!issued.ok) {
        return NextResponse.json({ error: issued.error }, { status: issued.status });
      }
      return NextResponse.json({
        ok: true,
        tempPassword,
        email,
        reissued: true,
      });
    }

    if (!authData?.user) {
      return NextResponse.json(
        { error: "Could not create user" },
        { status: 400 }
      );
    }

    const { error: profileError } = await syncStaffProfile(adminClient, {
      id: authData.user.id,
      full_name,
      email,
      role: targetRole,
    });

    if (profileError) {
      console.error("[team/invite] profile sync error:", profileError.message);
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
