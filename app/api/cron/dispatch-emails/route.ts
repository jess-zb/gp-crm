import { NextResponse } from "next/server";
import { normalizeCronSecret } from "@/lib/cron/verify-vercel-cron-request";
import { runEmailDispatch } from "@/lib/email/dispatch-for-client";
import { runStaffEmailDispatch } from "@/lib/email/dispatch-staff-emails";

export async function GET(req: Request) {
  const cronSecret = normalizeCronSecret(process.env.CRON_SECRET);
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientResult = await runEmailDispatch();
  const staffResult = await runStaffEmailDispatch();
  return NextResponse.json({ client: clientResult, staff: staffResult });
}
