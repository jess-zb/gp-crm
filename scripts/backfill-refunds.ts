/**
 * Creates `refunds` rows for clients who were already cancelled with
 * dnc_reason = 'refund' before the tracker existed.
 *
 * Amounts and processors are inferred from the client's cards, so every row is
 * flagged needs_review = true. Nothing is assumed settled: rows land as
 * `requested`, and whether the money actually went back is for a person to
 * confirm in the Refunds queue.
 *
 * Usage:
 *   npx tsx scripts/backfill-refunds.ts          # dry run, prints what it would do
 *   npx tsx scripts/backfill-refunds.ts --apply  # writes
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { refundPrefillFromCards } from "../lib/refunds/prefill";
import { formatMoneyUsdFromCents } from "../lib/utils/format";

const APPLY = process.argv.includes("--apply");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const CHUNK = 200;

async function main() {
  const { data: clients, error: clientErr } = await sb
    .from("clients")
    .select("id, first_name, last_name, fedex_merchant, updated_at")
    .eq("dnc_reason", "refund");

  if (clientErr) {
    console.error("Failed to load refund clients:", clientErr.message);
    process.exit(1);
  }
  if (!clients?.length) {
    console.log("No clients with dnc_reason = 'refund'. Nothing to do.");
    return;
  }

  const clientIds = clients.map((c) => c.id as string);

  // Skip anyone who already has a refund row, so the script is safe to re-run.
  const existing = new Set<string>();
  for (let i = 0; i < clientIds.length; i += CHUNK) {
    const { data, error } = await sb
      .from("refunds")
      .select("client_id")
      .in("client_id", clientIds.slice(i, i + CHUNK));
    if (error) {
      console.error("Failed to load existing refunds:", error.message);
      process.exit(1);
    }
    for (const row of data ?? []) existing.add(row.client_id as string);
  }

  const cardsByClient = new Map<
    string,
    { charge_amount_cents?: number | null; merchant_name?: string | null }[]
  >();
  for (let i = 0; i < clientIds.length; i += CHUNK) {
    const { data, error } = await sb
      .from("client_cards")
      .select("client_id, charge_amount_cents, merchant_name")
      .in("client_id", clientIds.slice(i, i + CHUNK));
    if (error) {
      console.error("Failed to load client cards:", error.message);
      process.exit(1);
    }
    for (const row of data ?? []) {
      const id = row.client_id as string;
      const bucket = cardsByClient.get(id) ?? [];
      bucket.push({
        charge_amount_cents: row.charge_amount_cents as number | null,
        merchant_name: row.merchant_name as string | null,
      });
      cardsByClient.set(id, bucket);
    }
  }

  const rows = clients
    .filter((c) => !existing.has(c.id as string))
    .map((c) => {
      const id = c.id as string;
      const prefill = refundPrefillFromCards(
        cardsByClient.get(id) ?? [],
        (c.fedex_merchant as string | null) ?? null
      );
      return {
        client_id: id,
        amount_cents: prefill.amountCents,
        processor_mid: prefill.processorMid,
        status: "requested",
        // No request timestamp survives on these records; the cancellation
        // update time is the closest available signal.
        requested_at: (c.updated_at as string | null) ?? new Date().toISOString(),
        requested_by_name: "Backfill",
        notes: "Backfilled from dnc_reason = refund. Amount and MID inferred from cards.",
        needs_review: true,
      };
    });

  console.log(
    `${clients.length} clients at dnc_reason = 'refund'; ${existing.size} already tracked; ${rows.length} to create.`
  );
  for (const row of rows) {
    const client = clients.find((c) => c.id === row.client_id);
    console.log(
      `  ${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trimEnd() +
        ` — ${formatMoneyUsdFromCents(row.amount_cents)} — ${row.processor_mid ?? "no MID"}`
    );
  }

  if (!rows.length) return;

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write these rows.");
    return;
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb.from("refunds").insert(rows.slice(i, i + CHUNK));
    if (error) {
      console.error("Insert failed:", error.message);
      process.exit(1);
    }
  }

  console.log(`\nCreated ${rows.length} refund rows, all flagged needs_review.`);
}

main();
