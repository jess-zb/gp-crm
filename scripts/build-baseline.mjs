#!/usr/bin/env node
/**
 * One-shot authoring tool: splits a `pg_dump --schema-only` of a verified
 * database into the Golden Pathway baseline under supabase/migrations.
 *
 * The source project's migration set cannot build a database from scratch — 12
 * of its 87 migrations fail on an empty Postgres — so the baseline is generated
 * from a database that was actually brought up, corrected and inspected.
 *
 * Statements are grouped by *concern* rather than by feature. Grouping by
 * feature reads nicely but reorders statements across dependency boundaries: a
 * `LANGUAGE sql` function has its body validated at creation, so
 * `crm_client_tab_counts` cannot be created before `clients` exists. Concern
 * groups preserve pg_dump's dependency order while still letting a reviewer
 * open one file to see every policy, or every trigger.
 *
 * Usage: node scripts/build-baseline.mjs <dump.sql> <out-dir>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [dumpPath, outDir] = process.argv.slice(2);
if (!dumpPath || !outDir) {
  console.error("usage: build-baseline.mjs <dump.sql> <out-dir>");
  process.exit(1);
}

/** Split into top-level statements, keeping $$-quoted function bodies intact. */
function splitStatements(sql) {
  const out = [];
  let buf = "";
  let inDollar = false;
  let dollarTag = "";
  for (const line of sql.split("\n")) {
    if (!inDollar && buf === "" && (/^--/.test(line) || line.trim() === "")) {
      continue; // pg_dump comment banners carry nothing the headers do not
    }
    if (!inDollar) {
      const open = line.match(/\$([A-Za-z_]*)\$/);
      if (open && (line.match(/\$([A-Za-z_]*)\$/g) || []).length % 2 === 1) {
        inDollar = true;
        dollarTag = open[0];
      }
    } else if (line.includes(dollarTag)) {
      inDollar = false;
    }
    buf += line + "\n";
    if (!inDollar && /;\s*$/.test(line)) {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function isNoise(s) {
  return (
    // newer pg_dump wraps output in psql \restrict / \unrestrict meta-commands
    /^\\(restrict|unrestrict|connect)/i.test(s) ||
    /^SET /i.test(s) ||
    /^SELECT pg_catalog\.set_config/i.test(s) ||
    /^(CREATE|COMMENT ON) EXTENSION/i.test(s) ||
    /^CREATE SCHEMA/i.test(s) ||
    /^ALTER (SCHEMA|DEFAULT PRIVILEGES)/i.test(s) ||
    /^REVOKE /i.test(s) ||
    /supabase_migrations/i.test(s)
  );
}

const GROUPS = [
  {
    file: "0001_types.sql",
    title: "Extensions and enums",
    match: (s) => /^CREATE TYPE/i.test(s),
    preamble:
      '\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pgcrypto";\n',
  },
  {
    file: "0002_tables.sql",
    title: "Tables, in dependency order",
    match: (s) => /^CREATE TABLE/i.test(s) || /^ALTER TABLE .* ALTER COLUMN .* SET DEFAULT/i.test(s),
  },
  {
    file: "0003_constraints_and_indexes.sql",
    title: "Primary keys, foreign keys, unique constraints and indexes",
    match: (s) =>
      /^ALTER TABLE ONLY/i.test(s) ||
      /^CREATE (UNIQUE )?INDEX/i.test(s),
  },
  {
    file: "0004_functions.sql",
    title: "Helper functions, RLS predicates and trigger bodies",
    match: (s) => /^CREATE (OR REPLACE )?FUNCTION/i.test(s),
  },
  {
    file: "0005_triggers.sql",
    title: "Triggers",
    match: (s) => /^CREATE (OR REPLACE )?TRIGGER/i.test(s),
  },
  {
    file: "0006_rls_policies.sql",
    title: "Row Level Security — the security boundary for this CRM",
    match: (s) => /^(ALTER TABLE .* ENABLE ROW LEVEL SECURITY|CREATE POLICY)/i.test(s),
  },
  {
    file: "0007_grants_realtime_comments.sql",
    title: "Role grants, realtime publications and column comments",
    match: () => true,
  },
];

const statements = splitStatements(readFileSync(dumpPath, "utf8")).filter(
  (s) => !isNoise(s)
);

const buckets = new Map(GROUPS.map((g) => [g.file, []]));
for (const s of statements) {
  const group = GROUPS.find((g) => g.match(s)) ?? GROUPS[GROUPS.length - 1];
  buckets.get(group.file).push(s);
}

mkdirSync(outDir, { recursive: true });
for (const g of GROUPS) {
  const body = buckets.get(g.file);
  const header = [
    `-- ${g.title}`,
    "--",
    "-- Golden Pathway baseline. Generated once from a verified database, then",
    "-- maintained by hand. See docs/golden-pathway-plan.md section 7.4.",
    "",
  ].join("\n");
  writeFileSync(
    join(outDir, g.file),
    header + (g.preamble ?? "") + body.join("\n\n") + "\n"
  );
  console.log(`${g.file}: ${body.length} statements`);
}
console.log(`total: ${statements.length}`);
