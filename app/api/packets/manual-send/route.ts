import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isDev } from "@/lib/roles";
import { toUserFacingError } from "@/lib/user-facing-error";
import { runManualFedexSend } from "@/lib/postlogic/run-manual-fedex-send";
import { callPdfGeneratorApi, advisorFirstNameForPdf } from "@/lib/packets/pdf-generator";
import {
  fetchFedexPrintBatchEnabled,
  PRINT_BATCH_PAUSED_MESSAGE,
} from "@/lib/packets/print-batch-setting";
import { recordPrintBatchRun } from "@/lib/packets/print-batch-runs";

/**
 * Dev-only: send a single Packets Needed recipient to PostLogic + PDF
 * generator, reusing the same send path as the automated batch (no cascade).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { profile } = await getProfileForUser(supabase, user);
    if (!profile || !isDev(profile.role)) {
      return NextResponse.json({ error: "Forbidden — dev only" }, { status: 403 });
    }

    const body = (await request.json()) as {
      clientId?: unknown;
      recipientType?: unknown;
    };
    const clientId =
      typeof body.clientId === "string" ? body.clientId.trim() : "";
    const recipientType =
      body.recipientType === "secondary" ? "secondary" : "primary";

    if (!clientId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!(await fetchFedexPrintBatchEnabled(admin))) {
      return NextResponse.json(
        { error: PRINT_BATCH_PAUSED_MESSAGE },
        { status: 403 }
      );
    }
    const result = await runManualFedexSend(admin, {
      clientId,
      recipientType,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: toUserFacingError(result.error) },
        { status: 400 }
      );
    }

    for (const row of result.sent) {
      const { error: auditErr } = await admin.from("audit_log").insert({
        client_id: row.clientId,
        action: "fedex_batch_sent",
        new_value: {
          batch_id: result.batchId,
          batch_date: result.batchId,
          manual: true,
          recipient_type: recipientType,
        },
        performed_by: user.id,
        performed_by_name: profile.full_name ?? "Dev",
      });
      if (auditErr) {
        console.warn("[manual-send] audit_log insert:", auditErr.message);
      }
    }

    await recordPrintBatchRun(admin, {
      batchId: result.batchId,
      status: "sent",
      sentCount: result.count,
      queuedCount: result.count,
      reason: "manual_send",
    });

    const pdfPayload = result.sent.map((c) => ({
      name: c.name,
      advisor: advisorFirstNameForPdf(c.advisor),
      merchant: c.merchant,
    }));
    const pdfResult = await callPdfGeneratorApi(pdfPayload);
    if (!pdfResult.success) {
      console.error("[manual-send] PDF generator error:", pdfResult.error);
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      batchId: result.batchId,
      sent: result.sent,
      pdfOk: pdfResult.success,
      message: `Sent ${result.count} packet(s) to print (batch ${result.batchId}).`,
    });
  } catch (err) {
    console.error("[api/packets/manual-send]", err);
    return NextResponse.json(
      { error: toUserFacingError(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
