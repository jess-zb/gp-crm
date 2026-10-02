/**
 * One-off: flip Melissa & Greg Lavalley Processing shipments → Pending
 * so they reappear in Packets Needed (Missing MID).
 *
 * Usage: npx tsx scripts/requeue-lavalley.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const CLIENT_ID = "3b6cfd00-f57e-4a5c-9128-e33e1c8aaed5"; // MELISSA LAVALLEY (+ Greg secondary)

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: before, error: beforeErr } = await sb
    .from("client_fedex_shipments")
    .select("id, recipient_name, recipient_type, status, batch_id")
    .eq("client_id", CLIENT_ID)
    .eq("status", "Processing");

  if (beforeErr) throw beforeErr;
  console.log("Before (Processing rows):", before);

  if (!before?.length) {
    console.log("No Processing shipments found — nothing to update.");
    return;
  }

  const ids = before.map((r) => r.id as string);
  const { data: after, error } = await sb
    .from("client_fedex_shipments")
    .update({ status: "Pending" })
    .in("id", ids)
    .select("id, recipient_name, recipient_type, status, batch_id");

  if (error) throw error;
  console.log("After (now Pending):", after);
  console.log(
    `✓ Requeued ${after?.length ?? 0} Lavalley shipment(s) — they will show in Packets Needed.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
