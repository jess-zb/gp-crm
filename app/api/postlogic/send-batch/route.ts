import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { canUsePostLogicApi } from "@/lib/roles";
import { toUserFacingError } from "@/lib/user-facing-error";
import { runPendingFedexBatch } from "@/lib/postlogic/run-pending-fedex-batch";
import { callPdfGeneratorApi, advisorFirstNameForPdf } from "@/lib/packets/pdf-generator";
import { notifyPacketSendOps } from "@/lib/packets/notify-packet-send-ops";
import { verifyVercelCronRequest } from "@/lib/cron/verify-vercel-cron-request";
import {
  fetchFedexPrintBatchEnabled,
  PRINT_BATCH_PAUSED_MESSAGE,
} from "@/lib/packets/print-batch-setting";
import { recordPrintBatchRun } from "@/lib/packets/print-batch-runs";
import { fetchPacketsNeeded } from "@/lib/packets/fetch-packet-manager-data";

/** Print batches can exceed the platform default (eligibility + PostLogic + PDF). */
export const maxDuration = 300;

/** Scheduled GET — Vercel cron only (Bearer CRON_SECRET). Triggers real mail. */
export async function GET(request: Request) {
  if (!verifyVercelCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const adminClient = await adminDb();
    if (!(await fetchFedexPrintBatchEnabled(adminClient))) {
      // 200 so Vercel cron stays green. Do not call PostLogic or the PDF generator.
      // Persist a skipped window so Packet Manager can show which dates were off.
      console.log("[send-batch] cron skipped: fedex_print_batch_disabled");
      const { rows: queued } = await fetchPacketsNeeded();
      const run = await recordPrintBatchRun(adminClient, {
        status: "skipped",
        queuedCount: queued.length,
        reason: "fedex_print_batch_disabled",
      });
      return NextResponse.json({
        ok: true,
        success: true,
        skipped: true,
        reason: "fedex_print_batch_disabled",
        message: PRINT_BATCH_PAUSED_MESSAGE,
        count: 0,
        batch_id: run?.batch_id ?? null,
        queued: queued.length,
      });
    }
    return await runSendBatch();
  } catch (err) {
    console.error("[api/postlogic/send-batch] GET:", err);
    await alertSendOps(
      "Packet batch cron failed",
      err instanceof Error ? err.message : "Cron send threw before print."
    );
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/** Manual send — requires authenticated staff with print-partner API access. */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { profile } = await getProfileForUser(supabase, user);
    if (!profile || !canUsePostLogicApi(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const adminClient = await adminDb();
    if (!(await fetchFedexPrintBatchEnabled(adminClient))) {
      return NextResponse.json(
        { error: PRINT_BATCH_PAUSED_MESSAGE },
        { status: 403 }
      );
    }
    return await runSendBatch();
  } catch (err) {
    console.error("[api/postlogic/send-batch] POST:", err);
    await alertSendOps(
      "Packet batch send failed",
      err instanceof Error ? err.message : "Manual send threw before print."
    );
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

async function adminDb() {
  return createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

async function alertSendOps(title: string, body: string) {
  try {
    await notifyPacketSendOps(await adminDb(), { title, body });
  } catch (e) {
    console.warn("[send-batch] ops alert failed:", e);
  }
}

async function runSendBatch() {
  console.log("[send-batch] start");

  const adminClient = await adminDb();

  const result = await runPendingFedexBatch(adminClient);
  if (!result.ok) {
    await alertSendOps(
      "Packet batch did not send",
      result.error
    );
    return NextResponse.json({ error: toUserFacingError(result.error) }, { status: 500 });
  }

  if (result.count === 0) {
    await recordPrintBatchRun(adminClient, {
      batchId: result.batchId,
      status: "empty",
      queuedCount: result.skipped,
      sentCount: 0,
      reason: "no_pending",
    });
    const missingNote =
      result.skippedMissingMid > 0
        ? ` ${result.skippedMissingMid} skipped for missing MID.`
        : "";
    return NextResponse.json({
      message:
        result.skipped > 0
          ? `No packets ready. ${result.skipped} skipped (incomplete data / missing MID).${missingNote}`
          : "No pending packets in queue",
      count: 0,
      skipped: result.skipped,
      skippedMissingMid: result.skippedMissingMid,
    });
  }

  await recordPrintBatchRun(adminClient, {
    batchId: result.batchId,
    status: "sent",
    queuedCount: result.count + result.skipped,
    sentCount: result.count,
    reason: null,
  });

  for (const row of result.sent) {
    const { error: auditErr } = await adminClient.from("audit_log").insert({
      client_id: row.clientId,
      action: "fedex_batch_sent",
      new_value: { batch_id: result.batchId, batch_date: result.batchId },
      performed_by_name: "System",
    });
    if (auditErr) {
      console.warn("[send-batch] audit_log insert:", auditErr.message);
    }
  }

  const pdfPayload = result.sent.map((c) => ({
    name: c.name,
    advisor: advisorFirstNameForPdf(c.advisor),
    merchant: c.merchant,
  }));

  // Same array order as PostLogic payload (Packets Needed Date Created ASC).
  // Do not push to PDF from set-merchant / auto-match — only here.
  console.log(
    "[send-batch] PDF/PostLogic order (first 5):",
    pdfPayload.slice(0, 5).map((r) => r.name)
  );
  const pdfResult = await callPdfGeneratorApi(pdfPayload);

  const skipParts: string[] = [];
  if (!pdfResult.success) {
    console.error("[send-batch] PDF generator error:", pdfResult.error);
    skipParts.push(
      "Print partner received the batch, but the PDF generator did not"
    );
    await alertSendOps(
      "Packet PDF list failed",
      `${result.count} packet(s) reached the printer (batch ${result.batchId}), but the PDF generator did not. ${pdfResult.error ?? ""}`.trim()
    );
  }
  if (result.skipped > result.skippedMissingMid) {
    skipParts.push(
      `${result.skipped - result.skippedMissingMid} skipped for incomplete data`
    );
  }
  if (result.skippedMissingMid > 0) {
    skipParts.push(
      `${result.skippedMissingMid} skipped for missing MID`
    );
  }

  return NextResponse.json({
    success: true,
    count: result.count,
    skipped: result.skipped,
    skippedMissingMid: result.skippedMissingMid,
    message:
      `${result.count} packet${result.count === 1 ? "" : "s"} sent to print.` +
      (skipParts.length ? ` ${skipParts.join("; ")}.` : "") +
      (result.skipped > 0
        ? " Incomplete or missing-MID rows will retry next batch."
        : ""),
    clients_sent: result.sent.map((c) => ({ id: c.clientId, name: c.name })),
  });
}
