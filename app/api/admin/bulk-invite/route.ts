import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import type { UserRole } from "@/lib/types/user-role";

type Body = {
  email?: string;
  full_name?: string;
  role?: string;
};

function looksLikeUserAlreadyExists(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already") ||
    m.includes("registered") ||
    m.includes("exists") ||
    m.includes("duplicate")
  );
}

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { status: "failed", error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { profile } = await getProfileForUser(supabaseAuth, user);
    if (!profile || profile.role !== "dev") {
      return NextResponse.json(
        { status: "failed", error: "Forbidden — developer role required" },
        { status: 403 }
      );
    }

    let body: Body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: "failed", error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const full_name =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const roleRaw = typeof body.role === "string" ? body.role.trim() : "";

    if (!email || !full_name || !roleRaw) {
      return NextResponse.json(
        {
          status: "failed",
          error: "Missing email, full_name, or role",
        },
        { status: 400 }
      );
    }

    const allowed: UserRole[] = [
      "dev",
      "admin",
      "acct_manager",
      "attorney",
      "client",
    ];
    if (!allowed.includes(roleRaw as UserRole)) {
      return NextResponse.json(
        { status: "failed", error: "Invalid role" },
        { status: 400 }
      );
    }
    const role = roleRaw as UserRole;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { status: "failed", error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ status: "exists" });
    }

    const tempPassword =
      "ZB" + Math.floor(100000 + Math.random() * 900000).toString();

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name, role },
      });

    if (authError) {
      if (looksLikeUserAlreadyExists(authError.message)) {
        return NextResponse.json({ status: "exists" });
      }
      return NextResponse.json({
        status: "failed",
        error: authError.message,
      });
    }

    if (!authData?.user) {
      return NextResponse.json({
        status: "failed",
        error: "Could not create auth user",
      });
    }

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: authData.user.id,
      full_name,
      email,
      role,
      is_active: true,
    });

    if (profileError) {
      // The signup trigger already inserted this profile. The account exists
      // and the temporary password is still valid.
      if (
        profileError.code === "23505" ||
        profileError.message.toLowerCase().includes("duplicate")
      ) {
        return NextResponse.json({
          status: "created",
          tempPassword,
        });
      }
      return NextResponse.json({
        status: "failed",
        error: profileError.message,
      });
    }

    return NextResponse.json({
      status: "created",
      tempPassword,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
