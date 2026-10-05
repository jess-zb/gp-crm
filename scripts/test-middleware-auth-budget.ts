/**
 * Pre-deploy gate: middleware must fail fast (not 504 at 25s) and must not
 * treat Auth slowness as sign-out.
 *
 * Run: npm run test:middleware-auth-budget
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MIDDLEWARE_AUTH_BUDGET_MS } from "../lib/middleware/auth-budget";
import {
  isMiddlewarePublicPath,
  isMiddlewareStaticPath,
} from "../lib/middleware/paths";
import { isTransientUpstreamFailure } from "../lib/supabase/transient-failure";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

console.log("Middleware auth budget smoke test\n");

assert.ok(
  MIDDLEWARE_AUTH_BUDGET_MS >= 500 && MIDDLEWARE_AUTH_BUDGET_MS <= 5_000,
  "middleware Auth budget must stay well under Vercel's 25s TTFB kill"
);
console.log(`  ✓ Auth budget is ${MIDDLEWARE_AUTH_BUDGET_MS}ms`);

assert.equal(isMiddlewarePublicPath("/sign/abc"), true);
assert.equal(isMiddlewarePublicPath("/api/sign/complete"), true);
assert.equal(isMiddlewarePublicPath("/attorney-batch/tok"), true);
assert.equal(isMiddlewarePublicPath("/api/attorney-batch/x"), true);
assert.equal(isMiddlewarePublicPath("/api/leads"), true);
assert.equal(isMiddlewarePublicPath("/clients"), false);
assert.equal(isMiddlewarePublicPath("/api/clients/documents/upload-init"), false);
console.log("  ✓ public paths skip Auth; CRM routes do not");

assert.equal(isMiddlewareStaticPath("/favicon.ico"), true);
assert.equal(isMiddlewareStaticPath("/clients"), false);

assert.equal(isTransientUpstreamFailure("Auth session missing!"), false);
assert.equal(isTransientUpstreamFailure("The operation was aborted due to timeout"), true);
assert.equal(isTransientUpstreamFailure("Failed to fetch"), true);
console.log("  ✓ timeout ≠ missing session");

const middlewareSrc = read("middleware.ts");
assert.match(middlewareSrc, /isMiddlewarePublicPath/);
assert.ok(
  middlewareSrc.indexOf("isMiddlewarePublicPath") < middlewareSrc.indexOf("getUser"),
  "public paths must return before getUser"
);
assert.match(middlewareSrc, /createMiddlewareAuthBudget/);
assert.match(middlewareSrc, /skipCookieWrites/);
assert.doesNotMatch(
  middlewareSrc,
  /redirectTo\(request,\s*["']\/login["']\)/,
  "middleware must not send people to login when Auth is slow"
);
assert.match(middlewareSrc, /isAttorneyPortalApiPath/);
console.log("  ✓ middleware: public first, budgeted Auth, no login redirect, attorney allowlist");

const crmLayout = read("app/(crm)/layout.tsx");
assert.match(crmLayout, /profile\.role === ["']attorney["']/);
assert.match(crmLayout, /redirect\(["']\/attorney\/cases["']\)/);
assert.match(crmLayout, /isTransientUpstreamFailure/);
console.log("  ✓ CRM layout dual-enforces attorney portal (no login on timeout)");

console.log("\nAll middleware auth budget checks passed.");
