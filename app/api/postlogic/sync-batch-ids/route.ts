import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { runPostlogicBatchIdSync } from "@/lib/postlogic/sync-batch-ids";
import { toUserFacingError } from "@/lib/user-facing-error";

const SYNC_ALLOWED_ROLES = new Set(["dev", "admin", "acct_manager"]);

function createAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

async function jsonSyncResponse(performedByLabel: string) {
  const adminClient = createAdminSupabase();
  const result = await runPostlogicBatchIdSync(adminClient, performedByLabel);

  if (!result.ok) {
    return NextResponse.json(
      { error: toUserFacingError(result.error) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    matched: result.matched,
    updated: result.updated,
    results: result.results,
    debug: {
      dates_checked: result.datesChecked,
      postlogic_endpoint: "connected",
    },
  });
}

/** GET — cron secret only (browser/cron). */
export async function GET(request: Request) {
  try {
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET?.trim();
    if (!expectedSecret || cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return await jsonSyncResponse("System");
  } catch (err) {
    console.error("[api/postlogic/sync-batch-ids] GET:", err);
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/**
 * POST — manual sync (session) OR pg_cron via `net.http_post` + `x-cron-secret`
 * (same secret as GET).
 */
export async function POST(request: Request) {
  try {
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET?.trim();
    if (expectedSecret && cronSecret === expectedSecret) {
      return await jsonSyncResponse("System");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { profile, error: pe } = await getProfileForUser(supabase, user);
    if (pe || !profile) {
      return NextResponse.json({ error: "Could not load profile" }, { status: 400 });
    }

    if (!SYNC_ALLOWED_ROLES.has(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const label =
      profile.full_name?.trim() || user.email?.trim() || "Admin";

    return await jsonSyncResponse(label);
  } catch (err) {
    console.error("[api/postlogic/sync-batch-ids] POST:", err);
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
