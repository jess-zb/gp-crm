/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_APP_URL,
  FORBIDDEN_CONTACT_PATTERNS,
} from "../lib/constants/business-contact";

const ROOT = process.cwd();

const SCAN_DIRS = ["app", "emails", "lib", "scripts", "supabase/migrations"] as const;

const SKIP_PATH_PARTS = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.next${path.sep}`,
  `${path.sep}graphify-out${path.sep}`,
  `${path.sep}check-business-contact.ts`,
  `${path.sep}business-contact.ts`,
  `${path.sep}20260429081800_email_message_templates.sql`,
  `${path.sep}20260429072600_email_sequences.sql`,
  `${path.sep}20260617000000_fix_email_dispatch.sql`,
  `${path.sep}20260506140000_backfill_assigned_compliance_alex.sql`,
  `${path.sep}20260730190000_scrub_legacy_zb_contact_info.sql`,
];

const EXTENSIONS = new Set([".ts", ".tsx", ".sql", ".md", ".mjs"]);

function shouldScan(filePath: string): boolean {
  if (!EXTENSIONS.has(path.extname(filePath))) return false;
  const rel = path.relative(ROOT, filePath);
  if (rel === "lib/constants/business-contact.ts") return false;
  if (rel.endsWith("20260730190000_scrub_legacy_zb_contact_info.sql")) return false;
  return !SKIP_PATH_PARTS.some((part) => filePath.includes(part));
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (shouldScan(full)) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  if (!/^https:\/\/[a-z0-9.-]+$/.test(DEFAULT_APP_URL)) {
    console.error(
      `DEFAULT_APP_URL must be a bare https origin with no trailing slash (got ${DEFAULT_APP_URL}).`
    );
    process.exit(1);
  }

  const violations: { file: string; pattern: string; line: number; excerpt: string }[] = [];

  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const rel = path.relative(ROOT, file);
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, idx) => {
        for (const pattern of FORBIDDEN_CONTACT_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: rel,
              pattern: String(pattern),
              line: idx + 1,
              excerpt: line.trim().slice(0, 120),
            });
          }
        }
      });
    }
  }

  if (violations.length) {
    console.error("Legacy Zero Balance contact info found:\n");
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  (${v.pattern})`);
      console.error(`    ${v.excerpt}\n`);
    }
    process.exit(1);
  }

  console.log("check-business-contact: OK — no legacy ZB contact patterns found.");
}

main();
