import { NextResponse } from "next/server";
import { syncSunsetSheet } from "@/lib/postlogic/sync-sunset-sheet";
import { verifyCronRequest } from "@/lib/cron/verify-vercel-cron-request";

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncSunsetSheet();

  if (result.error) {
    console.error("[sync-sunset] error:", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  console.log("[sync-sunset] synced:", result.synced);
  return NextResponse.json({ ok: true, synced: result.synced });
}
