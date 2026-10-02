/**
 * Run downloaded batch SQL files (e.g. zb_missing_clients_part1_of_5.sql) against Postgres.
 *
 * Why not supabase.rpc('exec_sql')?
 *   That RPC does not exist on Supabase by default. This script uses a direct
 *   Postgres connection instead (same as psql).
 *
 * Setup:
 *   1. Supabase Dashboard → Settings → Database → copy "URI" connection string
 *   2. Add to .env.local (never commit):
 *        DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
 *   3. Use Session pooler URI if you are on IPv4-only network.
 *
 * Usage:
 *   node scripts/run-sql-batch-files.mjs
 *   node scripts/run-sql-batch-files.mjs /path/to/folder/with/sql/files
 *
 * Optional env:
 *   SQL_BATCH_DIR=/path/to/dir   (overrides argv[1])
 */

import { config } from "dotenv";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import pg from "pg";

config({ path: ".env.local", override: true });
config();

const SQL_DIR =
  process.env.SQL_BATCH_DIR ||
  process.argv[2] ||
  join(homedir(), "Downloads");

const FILE_GROUPS = [
  { prefix: 'zb_fix_awaiting_excess', total: 1 },
];

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.error(
    "Missing DATABASE_URL. Add the Postgres URI from Supabase → Settings → Database to .env.local"
  );
  process.exit(1);
}

async function runFile(client, filepath) {
  const sql = readFileSync(filepath, "utf8").trim();
  if (!sql) return true;
  await client.query(sql);
  return true;
}

const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
  console.log(`Using SQL directory: ${SQL_DIR}\n`);

  for (const group of FILE_GROUPS) {
    console.log(`\n=== ${group.prefix} ===`);
    for (let i = 1; i <= group.total; i++) {
      const filename = `${group.prefix}${i}_of_${group.total}.sql`;
      const filepath = join(SQL_DIR, filename);
      process.stdout.write(`  ${filename}... `);
      if (!existsSync(filepath)) {
        console.log("❌ not found");
        continue;
      }
      try {
        await runFile(client, filepath);
        console.log("✅");
      } catch (e) {
        console.log(`❌ ${e?.message || e}`);
      }
    }
  }

  console.log("\nDone.");
} catch (e) {
  console.error("Connection or fatal error:", e?.message || e);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
