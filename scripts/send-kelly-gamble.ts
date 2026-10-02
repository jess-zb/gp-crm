/**
 * One-off: send Kelly Gamble through PostLogic + PDF generator using the
 * same path as a real batch (manual send helper), without cascading other
 * shipments.
 *
 * Usage: npx tsx scripts/send-kelly-gamble.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { runManualFedexSend } from "../lib/postlogic/run-manual-fedex-send";
import { callPdfGeneratorApi, advisorFirstNameForPdf } from "../lib/packets/pdf-generator";

const CLIENT_ID = "5f84835d-ac44-4929-8553-5065326f764f"; // KELLY GAMBLE

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  console.log("[send-kelly] starting manual send…");
  const result = await runManualFedexSend(sb, {
    clientId: CLIENT_ID,
    recipientType: "primary",
    // She is currently stage=dnc / inactive but still needs this one-off print.
    allowAnyStage: true,
    allowInactive: true,
  });

  if (!result.ok) {
    console.error("[send-kelly] FAILED:", result.error);
    process.exit(1);
  }

  for (const row of result.sent) {
    const { error: auditErr } = await sb.from("audit_log").insert({
      client_id: row.clientId,
      action: "fedex_batch_sent",
      new_value: {
        batch_id: result.batchId,
        batch_date: result.batchId,
        manual: true,
        reason: "one_off_kelly_gamble",
      },
      performed_by_name: "System",
    });
    if (auditErr) {
      console.warn("[send-kelly] audit_log insert:", auditErr.message);
    }
  }

  const pdfPayload = result.sent.map((c) => ({
    name: c.name,
    advisor: advisorFirstNameForPdf(c.advisor),
    merchant: c.merchant,
  }));
  console.log("[send-kelly] PDF payload:", pdfPayload);

  const pdfResult = await callPdfGeneratorApi(pdfPayload);
  if (!pdfResult.success) {
    console.error("[send-kelly] PDF generator error:", pdfResult.error);
  } else {
    console.log("[send-kelly] PDF generator ok, count:", pdfResult.count);
  }

  console.log(
    `✓ Sent ${result.count} recipient(s) for Kelly Gamble — batch ${result.batchId}`
  );
  console.log("sent:", result.sent);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
