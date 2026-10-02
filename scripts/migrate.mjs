#!/usr/bin/env node
/**
 * Applies pending SQL migrations from supabase/migrations, then records them.
 *
 * Runs as part of the Vercel production build (see the `vercel-build` script),
 * so schema changes land before the code that depends on them. A failed
 * migration fails the build and the previous deployment stays live.
 *
 * The ledger is supabase_migrations.schema_migrations -- the same table the
 * Supabase CLI uses -- so `supabase db push` and this runner agree on what has
 * been applied.
 *
 * Each migration runs inside its own transaction, so a mid-file failure leaves
 * nothing half-applied. That means migrations must not use statements which
 * cannot run in a transaction (CREATE INDEX CONCURRENTLY, ALTER TYPE ... ADD
 * VALUE on older Postgres).
 *
 * Usage:
 *   node scripts/migrate.mjs                    apply pending migrations
 *   node scripts/migrate.mjs --dry-run          list pending migrations, change nothing
 *   node scripts/migrate.mjs --baseline         record pending as applied WITHOUT running
 *   node scripts/migrate.mjs --until=<version>  only consider versions below <version>
 *
 * --until exists so a baseline cannot accidentally swallow a migration that
 * genuinely still needs to run.
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

/** Arbitrary fixed key so concurrent builds cannot apply migrations at once. */
const ADVISORY_LOCK_KEY = 8274531900112233n;

const argv = process.argv.slice(2);
const args = new Set(argv);
const DRY_RUN = args.has("--dry-run");
const BASELINE = args.has("--baseline");
const UNTIL = (() => {
  const flag = argv.find((a) => a.startsWith("--until="));
  return flag ? flag.slice("--until=".length) : null;
})();

function log(msg) {
  console.log(`[migrate] ${msg}`);
}

/**
 * Preview and development builds share the one production database, so they
 * must never mutate the schema. Only a production build migrates.
 */
function shouldSkipForEnvironment() {
  const vercelEnv = process.env.VERCEL_ENV;
  if (!vercelEnv) return false;
  if (vercelEnv === "production") return false;
  if (process.env.MIGRATE_ALLOW_NON_PRODUCTION === "1") return false;
  return true;
}

function parseVersion(filename) {
  const match = /^(\d+)_(.*)\.sql$/.exec(filename);
  if (!match) return null;
  return { version: match[1], name: match[2], filename };
}

async function readMigrations() {
  const entries = await readdir(MIGRATIONS_DIR);
  const parsed = entries
    .filter((f) => f.endsWith(".sql"))
    .map(parseVersion)
    .filter((m) => m !== null);

  const skipped = entries.filter(
    (f) => f.endsWith(".sql") && parseVersion(f) === null
  );
  if (skipped.length > 0) {
    throw new Error(
      `Migration filenames must be <version>_<name>.sql. Offending: ${skipped.join(", ")}`
    );
  }

  parsed.sort((a, b) => a.version.localeCompare(b.version));

  const seen = new Map();
  for (const m of parsed) {
    if (seen.has(m.version)) {
      throw new Error(
        `Duplicate migration version ${m.version}: ${seen.get(m.version)} and ${m.filename}`
      );
    }
    seen.set(m.version, m.filename);
  }

  return parsed;
}

async function ensureLedger(client) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS supabase_migrations`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version TEXT PRIMARY KEY,
      statements TEXT[],
      name TEXT
    )
  `);
}

async function appliedVersions(client) {
  const { rows } = await client.query(
    `SELECT version FROM supabase_migrations.schema_migrations`
  );
  return new Set(rows.map((r) => r.version));
}

async function main() {
  if (shouldSkipForEnvironment()) {
    log(
      `VERCEL_ENV=${process.env.VERCEL_ENV} is not production; skipping migrations. ` +
        `Set MIGRATE_ALLOW_NON_PRODUCTION=1 to override.`
    );
    return;
  }

  if (process.env.MIGRATE_SKIP === "1") {
    if (process.env.VERCEL_ENV === "production") {
      throw new Error(
        "MIGRATE_SKIP=1 is not allowed on production. Schema must land with the code."
      );
    }
    log(
      "WARNING: MIGRATE_SKIP=1 -- skipping migrations. Schema changes in this " +
        "deploy will NOT be applied. Unset this once the deploy is unblocked."
    );
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Refusing to build: pending SQL would not run " +
        "and new columns would 500. Set Production DATABASE_URL (Supabase session pooler, port 5432)."
    );
  }

  const migrations = await readMigrations();
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [
      ADVISORY_LOCK_KEY.toString(),
    ]);

    await ensureLedger(client);
    const applied = await appliedVersions(client);
    let pending = migrations.filter((m) => !applied.has(m.version));

    log(`${migrations.length} migration files, ${applied.size} already applied.`);

    if (UNTIL) {
      const before = pending.length;
      pending = pending.filter((m) => m.version < UNTIL);
      log(`--until=${UNTIL}: ${before} pending narrowed to ${pending.length}.`);
    }

    if (pending.length === 0) {
      log("Nothing to apply.");
      return;
    }

    log(`${pending.length} pending:`);
    for (const m of pending) log(`  - ${m.filename}`);

    if (DRY_RUN) {
      log("--dry-run: no changes made.");
      return;
    }

    if (BASELINE) {
      for (const m of pending) {
        await client.query(
          `INSERT INTO supabase_migrations.schema_migrations (version, name)
           VALUES ($1, $2) ON CONFLICT (version) DO NOTHING`,
          [m.version, m.name]
        );
      }
      log(
        `--baseline: recorded ${pending.length} migration(s) as applied without running them.`
      );
      return;
    }

    for (const m of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, m.filename), "utf8");
      log(`applying ${m.filename} ...`);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          `INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
           VALUES ($1, $2, $3)`,
          [m.version, m.name, [sql]]
        );
        await client.query("COMMIT");
        log(`applied ${m.filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`${m.filename} failed and was rolled back: ${error.message}`);
      }
    }

    log(`Done. Applied ${pending.length} migration(s).`);
  } finally {
    try {
      await client.query(`SELECT pg_advisory_unlock($1)`, [
        ADVISORY_LOCK_KEY.toString(),
      ]);
    } catch {
      // Connection is closing anyway; the lock is session-scoped.
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[migrate] FAILED: ${error.message}`);
  process.exit(1);
});
