/**
 * Regression check for client document uploads (DB triggers + document_type enum).
 * Run after migrations that touch documents INSERT triggers or document_type enum.
 *
 *   npm run verify:document-uploads
 *
 * Requires DATABASE_URL in .env.local (or env).
 */
import pg from "pg";
import { config } from "dotenv";
import { UI_DOCUMENT_TYPE_VALUES } from "../lib/clients/document-upload";

config({ path: ".env.local" });

const BANNED_TRIGGER_PATTERNS = [
  /COALESCE\s*\(\s*NEW\.document_type\s*,\s*''\s*\)/i,
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (use .env.local).");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  let failed = false;
  const ok = (msg: string) => console.log(`  ✓ ${msg}`);
  const fail = (msg: string) => {
    console.error(`  ✗ ${msg}`);
    failed = true;
  };

  console.log("Document upload health check\n");

  const fn = await client.query<{ def: string }>(
    `SELECT pg_get_functiondef('handle_collection_letter_upload()'::regprocedure) AS def`
  );
  const triggerSrc = fn.rows[0]?.def ?? "";
  for (const pattern of BANNED_TRIGGER_PATTERNS) {
    if (pattern.test(triggerSrc)) {
      fail(
        "handle_collection_letter_upload() uses COALESCE(NEW.document_type, '') — breaks all inserts"
      );
    } else {
      ok("collection-letter trigger avoids enum/empty-string COALESCE");
    }
  }
  if (!triggerSrc.includes("document_type::text")) {
    fail("handle_collection_letter_upload() should compare via NEW.document_type::text");
  }

  const enums = await client.query<{ enumlabel: string }>(
    `SELECT e.enumlabel
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typname = 'document_type'
     ORDER BY e.enumlabel`
  );
  const dbValues = new Set(enums.rows.map((r) => r.enumlabel));
  for (const v of UI_DOCUMENT_TYPE_VALUES) {
    if (!dbValues.has(v)) {
      fail(`Postgres document_type enum missing UI value "${v}"`);
    }
  }
  if (!failed) {
    ok(`all ${UI_DOCUMENT_TYPE_VALUES.length} UI document types exist in Postgres enum`);
  }

  const clientRow = await client.query<{ id: string }>(
    `SELECT id FROM clients ORDER BY created_at DESC LIMIT 1`
  );
  const clientId = clientRow.rows[0]?.id;
  if (!clientId) {
    fail("no clients row found for INSERT smoke test");
  } else {
    const path = `test/upload-health-${Date.now()}.pdf`;
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO documents (client_id, document_type, file_name, storage_path)
         VALUES ($1, 'upload', 'health-check.pdf', $2)`,
        [clientId, path]
      );
      await client.query("ROLLBACK");
      ok("INSERT smoke test (upload + both triggers) succeeded");
    } catch (e) {
      await client.query("ROLLBACK");
      fail(
        `INSERT smoke test failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  await client.end();
  if (failed) {
    console.error("\nDocument upload health check FAILED.");
    process.exit(1);
  }
  console.log("\nDocument upload health check passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
