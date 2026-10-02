import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { normalizeCronSecret } from "@/lib/cron/verify-vercel-cron-request";

/** Dev-only: trigger dispatch-emails cron with server CRON_SECRET (no client secret). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { profile, error: profileErr } = await getProfileForUser(supabase, user);
  if (profileErr || !profile || !["dev", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cronSecret = normalizeCronSecret(process.env.CRON_SECRET);
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const url = new URL("/api/cron/dispatch-emails", request.url);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cronSecret}` },
    cache: "no-store",
  });
  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}
