import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** After sign out, send users to /login on the deployed app by default. */
function loginPageUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  const base = raw.replace(/\/$/, "");
  return new URL("/login", base);
}

export async function GET() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(loginPageUrl());
}
