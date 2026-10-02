import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPacketCronAuthorized } from "@/lib/packets/cron-auth";
import { runSyncIdsForBatch } from "@/lib/packets/sync-batch-ids";

export async function GET(req: Request) {
  if (!isPacketCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data: batchRows, error: batchErr } = await supabase
      .from("client_fedex_shipments")
      .select("batch_id")
      .not("status", "in", '("Delivered","Archived")')
      .not("batch_id", "is", null)
      .order("batch_id", { ascending: false });

    if (batchErr) {
      return NextResponse.json({ error: batchErr.message }, { status: 500 });
    }

    const batchIds = Array.from(
      new Set(
        (batchRows ?? [])
          .map((r) => r.batch_id as string | null)
          .filter((id): id is string => !!id?.trim())
      )
    ).slice(0, 2);

    if (!batchIds.length) {
      return NextResponse.json({ message: "All batches delivered" });
    }

    const results: Array<{ batchId: string } & Awaited<ReturnType<typeof runSyncIdsForBatch>>> =
      [];

    for (const batchId of batchIds) {
      const data = await runSyncIdsForBatch(batchId);
      results.push({ batchId, ...data });
      console.log("[Cron] sync result:", batchId, data);
    }

    return NextResponse.json({
      batches: results.length,
      results,
    });
  } catch (err) {
    console.error("[api/packets/update-tracking]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
