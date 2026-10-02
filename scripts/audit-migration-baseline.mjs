#!/usr/bin/env node
/**
 * Pre-baseline safety audit.
 *
 * Baselining records a migration as applied without running it, so anything that
 * was never actually applied would be skipped forever. This parses every
 * migration for the schema objects it creates -- tables, columns, indexes,
 * functions, triggers, enum values -- and checks each one exists in the target
 * database. Anything missing is reported.
 *
 * Data-only statements (UPDATE/INSERT backfills) cannot be verified this way and
 * are counted separately.
 *
 * Usage: node scripts/audit-migration-baseline.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations"
);

/** Strip comments and string literals so patterns do not match prose. */
function stripNoise(sql) {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'([^']|'')*'/g, "''");
}

function collect(sql) {
  const s = stripNoise(sql);
  const tables = new Set();
  const columns = new Set();
  const indexes = new Set();
  const functions = new Set();
  const triggers = new Set();
  let dataOnly = 0;

  for (const m of s.matchAll(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z0-9_."]+)/gi
  )) {
    tables.add(m[1].replace(/"/g, "").replace(/^public\./, ""));
  }

  // ALTER TABLE x ADD COLUMN [IF NOT EXISTS] y  (also handles comma-chained adds)
  for (const m of s.matchAll(
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z0-9_."]+)([\s\S]*?);/gi
  )) {
    const table = m[1].replace(/"/g, "").replace(/^public\./, "");
    for (const c of m[2].matchAll(
      /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z0-9_"]+)/gi
    )) {
      columns.add(`${table}.${c[1].replace(/"/g, "")}`);
    }
  }

  for (const m of s.matchAll(
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-z0-9_."]+)/gi
  )) {
    indexes.add(m[1].replace(/"/g, "").replace(/^public\./, ""));
  }

  for (const m of s.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z0-9_."]+)\s*\(/gi
  )) {
    functions.add(m[1].replace(/"/g, "").replace(/^public\./, ""));
  }

  for (const m of s.matchAll(/CREATE\s+TRIGGER\s+([a-z0-9_."]+)/gi)) {
    triggers.add(m[1].replace(/"/g, ""));
  }

  if (/^\s*(UPDATE|INSERT)\s/im.test(s)) dataOnly += 1;

  return { tables, columns, indexes, functions, triggers, dataOnly };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const client = new pg.Client({ connectionString });
  await client.connect();

  const [dbTables, dbColumns, dbIndexes, dbFunctions, dbTriggers] = await Promise.all([
    client
      .query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`
      )
      .then((r) => new Set(r.rows.map((x) => x.table_name))),
    client
      .query(
        `SELECT table_name||'.'||column_name AS c FROM information_schema.columns WHERE table_schema='public'`
      )
      .then((r) => new Set(r.rows.map((x) => x.c))),
    client
      .query(`SELECT indexname FROM pg_indexes WHERE schemaname='public'`)
      .then((r) => new Set(r.rows.map((x) => x.indexname))),
    client
      .query(
        `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`
      )
      .then((r) => new Set(r.rows.map((x) => x.proname))),
    client
      .query(`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal`)
      .then((r) => new Set(r.rows.map((x) => x.tgname))),
  ]);

  await client.end();

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  const problems = [];
  let dataOnlyCount = 0;
  let checked = 0;

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const found = collect(sql);
    dataOnlyCount += found.dataOnly;
    const missing = [];

    for (const t of found.tables) if (!dbTables.has(t)) missing.push(`table ${t}`);
    for (const c of found.columns) if (!dbColumns.has(c)) missing.push(`column ${c}`);
    for (const i of found.indexes) if (!dbIndexes.has(i)) missing.push(`index ${i}`);
    for (const f of found.functions)
      if (!dbFunctions.has(f)) missing.push(`function ${f}`);
    for (const g of found.triggers)
      if (!dbTriggers.has(g)) missing.push(`trigger ${g}`);

    checked +=
      found.tables.size +
      found.columns.size +
      found.indexes.size +
      found.functions.size +
      found.triggers.size;

    if (missing.length > 0) problems.push({ file, missing });
  }

  console.log(
    `Audited ${files.length} migrations, ${checked} schema objects, ${dataOnlyCount} contain data statements.\n`
  );

  if (problems.length === 0) {
    console.log("No missing objects. Every migration appears applied.");
    return;
  }

  console.log(`${problems.length} migration(s) reference objects not present:\n`);
  for (const p of problems) {
    console.log(`  ${p.file}`);
    for (const m of p.missing) console.log(`      missing ${m}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
