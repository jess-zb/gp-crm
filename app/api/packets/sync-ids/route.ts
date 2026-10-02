import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canAccessFedExBatches } from "@/lib/roles";
import { isPacketCronAuthorized } from "@/lib/packets/cron-auth";
import { runSyncIdsForBatch } from "@/lib/packets/sync-batch-ids";

export async function POST(req: Request) {
  try {
    if (!isPacketCronAuthorized(req)) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const { profile } = await getProfileForUser(supabase, user);
      if (!profile || !canAccessFedExBatches(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = (await req.json()) as { batchId?: string };
    const batchId = body.batchId?.trim();
    if (!batchId) {
      return NextResponse.json({ error: "batchId required" }, { status: 400 });
    }

    const result = await runSyncIdsForBatch(batchId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      synced: result.synced,
      total: result.total,
      message: result.message,
    });
  } catch (err) {
    console.error("[api/packets/sync-ids]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
