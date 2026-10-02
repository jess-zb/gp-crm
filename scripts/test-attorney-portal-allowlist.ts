/**
 * Smoke test — attorney portal download API must stay middleware-allowlisted.
 * Run: npm run test:attorney-portal-allowlist
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ATTORNEY_PORTAL_API_ALLOWLIST,
  isAttorneyPortalApiPath,
} from "../lib/attorney/portal-api-allowlist";

const DOWNLOAD = "/api/clients/documents/download";

console.log("Attorney portal middleware allowlist smoke test\n");

assert.ok(
  ATTORNEY_PORTAL_API_ALLOWLIST.includes(DOWNLOAD),
  `${DOWNLOAD} must be in ATTORNEY_PORTAL_API_ALLOWLIST`
);
console.log("  ✓ allowlist includes document download API");

assert.equal(isAttorneyPortalApiPath(DOWNLOAD), true);
assert.equal(
  isAttorneyPortalApiPath(`${DOWNLOAD}?documentId=x&inline=1`.split("?")[0]!),
  true
);
assert.equal(isAttorneyPortalApiPath("/api/clients/documents/upload-init"), false);
assert.equal(isAttorneyPortalApiPath("/clients"), false);
console.log("  ✓ isAttorneyPortalApiPath matches download only");

const middlewareSrc = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
assert.match(
  middlewareSrc,
  /isAttorneyPortalApiPath/,
  "middleware.ts must call isAttorneyPortalApiPath before attorney Cases redirect"
);
assert.match(
  middlewareSrc,
  /portal-api-allowlist/,
  "middleware.ts must import portal-api-allowlist"
);
console.log("  ✓ middleware.ts wires the allowlist helper");

console.log("\nAll attorney portal allowlist checks passed.");
