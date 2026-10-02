/**
 * Proves the database satisfies what the application actually queries.
 *
 * The source project's migration set could not build a database from scratch,
 * so the Golden Pathway baseline was generated from a corrected reference
 * database. That makes "does the schema match the code?" a question worth
 * answering mechanically rather than by eye.
 *
 * Walks every `.from("table").select("a, b, c")` pair in app/ and lib/, then
 * checks each table and column exists. Also asserts RLS is enabled on every
 * public table, because RLS is the security boundary for this CRM.
 *
 * Run: pnpm verify:schema   (needs a reachable database)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import pg from "pg";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "lib"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

/** Embedded resources and PostgREST operators are not column names. */
const NOT_A_COLUMN = /[()!*]|->|::|\.|^\s*$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(extname(full))) out.push(full);
  }
  return out;
}

type Ref = { table: string; column: string; file: string };

/**
 * `.from("x")` and the `.select("...")` that follows it. Deliberately simple:
 * it over-collects rather than under-collects, and anything ambiguous is
 * filtered by NOT_A_COLUMN.
 */
function collectRefs(source: string, file: string): Ref[] {
  const refs: Ref[] = [];
  const pattern =
    /\.from\(\s*["'`](\w+)["'`]\s*\)([\s\S]{0,900}?)\.select\(\s*(["'`])([\s\S]*?)\3/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(source))) {
    const table = m[1];
    const between = m[2];
    // a second .from() in between means the select belongs to another query
    if (/\.from\(/.test(between)) continue;
    // Embedded resources — `client:client_id(id, first_name)` — name columns on
    // the joined table, not this one. Drop the parenthesised block and the
    // relationship label in front of it.
    const flat = m[4]
      .replace(/[\w:!]*\s*\([^()]*\)/g, "")
      .replace(/\$\{[^}]*\}/g, "");
    for (const raw of flat.split(",")) {
      const column = raw.trim();
      if (!column || NOT_A_COLUMN.test(column)) continue;
      refs.push({ table, column, file });
    }
  }
  return refs;
}

async function main() {
  const url =
    process.env.SUPABASE_DB_URL ??
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const { rows: colRows } = await client.query<{
    table_name: string;
    column_name: string;
  }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'`
  );
  const columns = new Map<string, Set<string>>();
  for (const r of colRows) {
    if (!columns.has(r.table_name)) columns.set(r.table_name, new Set());
    columns.get(r.table_name)!.add(r.column_name);
  }

  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
  const refs = files.flatMap((f) =>
    collectRefs(readFileSync(f, "utf8"), f.replace(`${ROOT}/`, ""))
  );

  const missingTables = new Map<string, string>();
  const missingColumns: Ref[] = [];
  for (const ref of refs) {
    const table = columns.get(ref.table);
    if (!table) {
      if (!missingTables.has(ref.table)) missingTables.set(ref.table, ref.file);
      continue;
    }
    if (!table.has(ref.column)) missingColumns.push(ref);
  }

  const { rows: noRls } = await client.query<{ relname: string }>(
    `SELECT c.relname FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
     ORDER BY 1`
  );

  await client.end();

  const checked = new Set(refs.map((r) => `${r.table}.${r.column}`)).size;
  console.log(
    `schema contract: ${refs.length} references across ${files.length} files ` +
      `(${checked} distinct table.column pairs)\n`
  );

  let failed = false;

  if (missingTables.size) {
    failed = true;
    console.error("Missing tables:");
    for (const [t, f] of missingTables) console.error(`  ${t}  (${f})`);
    console.error("");
  }

  if (missingColumns.length) {
    failed = true;
    console.error("Missing columns:");
    for (const r of missingColumns) {
      console.error(`  ${r.table}.${r.column}  (${r.file})`);
    }
    console.error("");
  }

  if (noRls.length) {
    failed = true;
    console.error("Tables without Row Level Security:");
    for (const r of noRls) console.error(`  ${r.relname}`);
    console.error("");
  }

  if (failed) {
    console.error("schema contract FAILED");
    process.exit(1);
  }

  console.log("  \u2713 every queried table and column exists");
  console.log("  \u2713 Row Level Security enabled on every public table");
  console.log("\nSchema contract satisfied.");
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
