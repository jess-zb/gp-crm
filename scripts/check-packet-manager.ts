import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // ── Packets Needed ──────────────────────────────────────────────────────────
  const { data: needed } = await sb
    .from("clients")
    .select("id, first_name, last_name, fedex_queued_at, fedex_batch_sent_at, delivery_method")
    .eq("stage", "welcome_packet")
    .eq("is_active", true)
    .eq("delivery_method", "fedex")
    .is("fedex_batch_sent_at", null)
    .order("fedex_queued_at", { ascending: true, nullsFirst: false });

  console.log(`\n📋 PACKETS NEEDED: ${needed?.length ?? 0} clients`);
  needed?.forEach(c => console.log(`  • ${c.first_name} ${c.last_name}`));

  // ── All shipments grouped by batch ─────────────────────────────────────────
  const { data: shipments } = await sb
    .from("client_fedex_shipments")
    .select("batch_id, batch_date, status, recipient_name, tracking_number")
    .order("batch_date", { ascending: false });

  const batches = new Map<string, { statuses: string[]; names: string[] }>();
  for (const s of shipments ?? []) {
    const key = s.batch_id ?? "no-batch";
    if (!batches.has(key)) batches.set(key, { statuses: [], names: [] });
    batches.get(key)!.statuses.push(s.status ?? "");
    batches.get(key)!.names.push(s.recipient_name ?? "");
  }

  const sortedBatches = Array.from(batches.entries()).sort(([a], [b]) => b.localeCompare(a));
  const [latest, second, ...archive] = sortedBatches;

  console.log(`\n📦 PACKETS SENT (latest batch: ${latest?.[0] ?? "none"})`);
  if (latest) {
    const statusCounts = latest[1].statuses.reduce((acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    console.log(`  ${latest[1].names.length} shipments — ${JSON.stringify(statusCounts)}`);
    latest[1].names.slice(0, 5).forEach(n => console.log(`    • ${n}`));
    if (latest[1].names.length > 5) console.log(`    … and ${latest[1].names.length - 5} more`);
  }

  console.log(`\n🚚 PACKETS DELIVERED (second batch: ${second?.[0] ?? "none"})`);
  if (second) {
    const statusCounts = second[1].statuses.reduce((acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    console.log(`  ${second[1].names.length} shipments — ${JSON.stringify(statusCounts)}`);
  }

  console.log(`\n🗄️  ARCHIVE: ${archive.length} older batches`);
  archive.forEach(([batchId, data]) => console.log(`  ${batchId}: ${data.names.length} shipments`));

  // ── Sunday batch check ──────────────────────────────────────────────────────
  console.log(`\n🔍 SUNDAY BATCH CHECK (2026-06-01):`);
  const { data: sundayBatch } = await sb
    .from("client_fedex_shipments")
    .select("recipient_name, status, tracking_number, batch_id")
    .eq("batch_id", "2026-06-01");
  if (!sundayBatch?.length) {
    console.log("  No 2026-06-01 batch found — Sunday cron may not have run yet.");
  } else {
    console.log(`  ${sundayBatch.length} rows in 2026-06-01 batch`);
    sundayBatch.forEach(s => console.log(`  • ${s.recipient_name} — ${s.status} — ${s.tracking_number ?? "no tracking"}`));
  }
}

main();
