/**
 * One-off backfill: insert 36 pre-existing PostLogic shipments (May 20/25/28 2026)
 * into client_fedex_shipments so they appear in the Archive tab and per-client history.
 *
 * Run (after confirming Section 6 is working):
 *   pnpm tsx scripts/backfill-may-2026-shipments.ts
 *
 * Unmatched rows are written to scripts/backfill-unmatched.txt for manual reconciliation.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// ── Supabase client ──────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

// ── TSV parsing ──────────────────────────────────────────────────────────────

type TsvRow = {
  name: string;
  advisor: string;
  merchant: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  status: string;
  tracking: string;
  date: string; // "M/D/YYYY"
};

function parseTsv(filePath: string): TsvRow[] {
  const text = readFileSync(filePath, "utf-8");
  const lines = text.trim().split("\n");
  const [, ...dataLines] = lines; // skip header row

  return dataLines.map((line) => {
    const cols = line.split("\t");
    return {
      name: cols[0]?.trim() ?? "",
      advisor: cols[1]?.trim() ?? "",
      merchant: cols[2]?.trim() ?? "",
      address: cols[3]?.trim() ?? "",
      city: cols[4]?.trim() ?? "",
      state: cols[5]?.trim() ?? "",
      zip: cols[6]?.trim() ?? "",
      phone: cols[7]?.trim() ?? "",
      status: cols[8]?.trim() ?? "",
      tracking: cols[9]?.trim() ?? "",
      date: cols[10]?.trim() ?? "",
    };
  });
}

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Convert "M/D/YYYY" → "YYYY-MM-DD" */
function toBatchId(dateStr: string): string {
  const [m, d, y] = dateStr.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** sent_at = batch_date at 20:00 US Eastern (EDT = UTC-4) */
function toSentAt(batchId: string): string {
  return `${batchId}T20:00:00-04:00`;
}

// ── Client lookup ────────────────────────────────────────────────────────────

function parseName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

async function lookupClientId(firstName: string, lastName: string): Promise<string | null> {
  const { data } = await supabase
    .from("clients")
    .select("id")
    .or(
      `and(first_name.ilike.${firstName},last_name.ilike.${lastName}),` +
      `and(spouse_first_name.ilike.${firstName},spouse_last_name.ilike.${lastName})`
    )
    .limit(1);
  return data?.[0]?.id ?? null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const tsvPath = resolve(process.cwd(), "data/backfill-may-2026-shipments.tsv");
  const rows = parseTsv(tsvPath);
  console.log(`Parsed ${rows.length} rows from TSV.\n`);

  // Fetch existing tracking numbers so we can skip duplicates
  const batchIds = [...new Set(rows.map((r) => toBatchId(r.date)))];
  console.log(`Batch IDs in TSV: ${batchIds.join(", ")}`);

  const { data: existing } = await supabase
    .from("client_fedex_shipments")
    .select("tracking_number")
    .in("batch_id", batchIds)
    .not("tracking_number", "is", null);

  const existingTracking = new Set(
    (existing ?? []).map((r: { tracking_number: string }) => r.tracking_number)
  );
  console.log(`Found ${existingTracking.size} existing tracking numbers for these batches.\n`);

  // Build insert rows
  const toInsert: Record<string, unknown>[] = [];
  const unmatched: string[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const tracking = row.tracking;

    if (existingTracking.has(tracking)) {
      skipped.push(`SKIP (duplicate) ${row.name} — tracking ${tracking}`);
      continue;
    }

    const { first, last } = parseName(row.name);
    const clientId = await lookupClientId(first, last);

    if (!clientId) {
      unmatched.push(`UNMATCHED: "${row.name}" (${row.date}, tracking ${tracking})`);
    }

    const batchId = toBatchId(row.date);
    toInsert.push({
      client_id: clientId ?? null,
      recipient_name: row.name,
      recipient_type: "primary",
      carrier: "fedex",
      batch_id: batchId,
      batch_date: batchId,
      status: "Completed",
      advisor: row.advisor,
      merchant: row.merchant,
      street_address: row.address,
      city: row.city,
      state: row.state,
      zip_code: row.zip,
      phone: row.phone,
      tracking_number: tracking,
      sent_at: toSentAt(batchId),
      delivered_at: null,
    });
  }

  // Report skipped
  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length} already-present rows:`);
    skipped.forEach((s) => console.log(`  ${s}`));
    console.log();
  }

  // Report unmatched
  if (unmatched.length > 0) {
    console.warn(`⚠  ${unmatched.length} row(s) have no matching client_id (will insert with client_id = NULL):`);
    unmatched.forEach((u) => console.warn(`  ${u}`));
    const unmatchedPath = resolve(process.cwd(), "scripts/backfill-unmatched.txt");
    writeFileSync(unmatchedPath, unmatched.join("\n") + "\n", "utf-8");
    console.warn(`\n  Wrote unmatched list to ${unmatchedPath}\n`);
  } else {
    console.log("All rows matched to a client_id.\n");
  }

  if (toInsert.length === 0) {
    console.log("Nothing new to insert. Done.");
    return;
  }

  // Insert in batches of 50
  console.log(`Inserting ${toInsert.length} new rows…`);
  const CHUNK = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from("client_fedex_shipments").insert(chunk);
    if (error) {
      console.error(`  Chunk ${i}–${i + chunk.length} error:`, error.message);
      errors += chunk.length;
    } else {
      inserted += chunk.length;
    }
  }

  console.log(`\n✓ Inserted ${inserted} rows (${errors} errors).`);

  // Final summary by batch
  console.log("\nBatch breakdown:");
  for (const batchId of batchIds.sort()) {
    const n = toInsert.filter((r) => r.batch_id === batchId).length;
    console.log(`  ${batchId}  →  ${n} new rows inserted`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
