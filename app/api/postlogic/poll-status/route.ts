import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canUsePostLogicApi } from "@/lib/roles";
import { verifyVercelCronRequest } from "@/lib/cron/verify-vercel-cron-request";
import {
  runPostlogicArchiveStatusRefresh,
  runPostlogicPollStatus,
  type PollStatusResultRow,
} from "@/lib/postlogic/poll-status";
import { toUserFacingError } from "@/lib/user-facing-error";

/** Public app URL — used when env is unset (e.g. some cron contexts). */
const NEXT_PUBLIC_APP_URL_OR_DEFAULT =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

function isCronHeaders(request: Request): boolean {
  return verifyVercelCronRequest(request);
}

/** Allow standard cron headers (Authorization Bearer) or an authenticated session. */
async function denyUnlessCronOrSession(
  request: Request
): Promise<Response | null> {
  if (!verifyVercelCronRequest(request)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return null;
}

function jsonSuccess(
  result: {
    polled: number;
    updated: number;
    results: PollStatusResultRow[];
  },
  polledAt: string
) {
  return NextResponse.json({
    ok: true,
    success: true,
    polled: result.polled,
    checked: result.polled,
    updated: result.updated,
    results: result.results,
    polledAt,
  });
}

/** After per-client PostLogic polls, run batch shipment sync (Print IDs + status fallback). */
async function triggerBatchSyncFromPoll() {
  try {
    const expectedSecret = process.env.CRON_SECRET?.trim();
    if (!expectedSecret) {
      console.warn(
        "[api/postlogic/poll-status] triggerBatchSyncFromPoll skipped: CRON_SECRET not set"
      );
      return;
    }

    const base = NEXT_PUBLIC_APP_URL_OR_DEFAULT.replace(/\/$/, "");
    const url = `${base}/api/postlogic/sync-batch-ids`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-cron-secret": expectedSecret,
        Authorization: `Bearer ${expectedSecret}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(
        "[api/postlogic/poll-status] batch sync fallback HTTP",
        res.status
      );
    }
  } catch (err) {
    console.error("[api/postlogic/poll-status] Batch sync in poll failed:", err);
  }
}

async function runPollStatus(opts: {
  clientId?: string;
  performedBy?: string;
  performedByName?: string;
}) {
  const polledAt = new Date().toISOString();
  console.log("[api/postlogic/poll-status] runPollStatus", {
    clientId: opts.clientId ?? null,
    mode: opts.performedBy ? "authenticated" : "service/cron",
    polledAt,
    appUrl: NEXT_PUBLIC_APP_URL_OR_DEFAULT,
  });

  const adminClient = createServiceClient();
  const result = await runPostlogicPollStatus(adminClient, opts);

  if (!result.ok) {
    console.error("[api/postlogic/poll-status] failed:", result.error);
    return NextResponse.json(
      { error: toUserFacingError(result.error) },
      { status: 500 }
    );
  }

  await triggerBatchSyncFromPoll();

  if (result.polled === 0) {
    return NextResponse.json({
      message: "No pending shipments",
      updated: 0,
      polled: 0,
      checked: 0,
      results: [],
      polledAt,
    });
  }

  console.log("[api/postlogic/poll-status] ok", {
    polled: result.polled,
    updated: result.updated,
    resultCount: result.results.length,
  });

  return jsonSuccess(result, polledAt);
}

async function runArchiveRefresh(opts: {
  performedBy?: string;
  performedByName?: string;
}) {
  const polledAt = new Date().toISOString();
  const adminClient = createServiceClient();
  const result = await runPostlogicArchiveStatusRefresh(adminClient, opts);

  if (!result.ok) {
    console.error("[api/postlogic/poll-status] archive refresh failed:", result.error);
    return NextResponse.json(
      { error: toUserFacingError(result.error) },
      { status: 500 }
    );
  }

  await triggerBatchSyncFromPoll();

  if (result.polled === 0) {
    return NextResponse.json({
      message: "No archive clients to refresh",
      updated: 0,
      polled: 0,
      checked: 0,
      results: [],
      polledAt,
    });
  }

  console.log("[api/postlogic/poll-status] archive refresh ok", {
    polled: result.polled,
    updated: result.updated,
    resultCount: result.results.length,
  });

  return jsonSuccess(result, polledAt);
}

/** GET — cron secret only (Authorization Bearer). */
export async function GET(request: Request) {
  if (!verifyVercelCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runPollStatus({});
  } catch (err) {
    console.error("[api/postlogic/poll-status] GET:", err);
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/** POST — cron headers run full poll without cookies; otherwise staff manual flow. */
export async function POST(request: Request) {
  try {
    const deny = await denyUnlessCronOrSession(request);
    if (deny) return deny;

    if (isCronHeaders(request)) {
      return runPollStatus({});
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile } = await getProfileForUser(supabase, user);
    if (!profile || !canUsePostLogicApi(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let clientId: string | undefined;
    let archiveRefreshAll = false;
    try {
      const body = await request.json();
      if (body && typeof body.clientId === "string" && body.clientId.trim()) {
        clientId = body.clientId.trim();
      }
      if (body?.archiveRefreshAll === true) {
        archiveRefreshAll = true;
      }
    } catch {
      clientId = undefined;
      archiveRefreshAll = false;
    }

    const performedByName =
      profile.full_name?.trim() || user.email || "Admin";

    if (archiveRefreshAll) {
      return runArchiveRefresh({
        performedBy: user.id,
        performedByName,
      });
    }

    return runPollStatus({
      clientId,
      performedBy: user.id,
      performedByName,
    });
  } catch (err) {
    console.error("[api/postlogic/poll-status] POST:", err);
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
