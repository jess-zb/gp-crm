/**
 * Smoke test — POA stage gate must match checklist signals (document on file OR poa_signed_at).
 * Run: npm run test:stage-poa-gate
 */
import assert from "node:assert/strict";
import {
  blockAdvanceFromAccountManagerWithoutCcAuth,
  blockAdvanceFromClientServicesWithoutPoa,
  hasCcAuthorizationOnRecord,
} from "../lib/workflow/stage-blockers";
import {
  hasSignedPoaOnRecord,
  poaAdvanceAlreadyApplied,
  shouldAttemptPoaAdvance,
} from "../lib/clients/poa-upload-advance";

console.log("POA stage gate smoke test\n");

const from = "client_services";
const to = "awaiting_collection_letter";

assert.equal(
  blockAdvanceFromClientServicesWithoutPoa({
    fromStage: from,
    toStage: to,
    poaSignedAt: null,
    hasPoaDocument: false,
  }).blocked,
  true,
  "blocks when no POA document and no poa_signed_at"
);
console.log("  ✓ blocks without POA on file");

assert.equal(
  blockAdvanceFromClientServicesWithoutPoa({
    fromStage: from,
    toStage: to,
    poaSignedAt: null,
    hasPoaDocument: true,
  }).blocked,
  false,
  "allows when POA document exists (Uploads tab path)"
);
console.log("  ✓ allows when POA document is on file");

assert.equal(
  blockAdvanceFromClientServicesWithoutPoa({
    fromStage: from,
    toStage: to,
    poaSignedAt: "2026-01-01T00:00:00.000Z",
    hasPoaDocument: false,
  }).blocked,
  false,
  "allows when poa_signed_at is set"
);
console.log("  ✓ allows when poa_signed_at is set");

const blocked = blockAdvanceFromClientServicesWithoutPoa({
  fromStage: from,
  toStage: to,
  poaSignedAt: null,
  hasPoaDocument: false,
});
assert.ok(
  blocked.reason && !/docusign/i.test(blocked.reason),
  "error message must not mention DocuSign"
);
console.log("  ✓ error message has no DocuSign wording");

assert.equal(hasSignedPoaOnRecord({ hasPoaDocument: true, poaSignedAt: null }), true);
assert.equal(hasSignedPoaOnRecord({ hasPoaDocument: false, poaSignedAt: "x" }), true);
assert.equal(hasSignedPoaOnRecord({ hasPoaDocument: false, poaSignedAt: null }), false);
console.log("  ✓ hasSignedPoaOnRecord matches checklist logic");

assert.equal(poaAdvanceAlreadyApplied("client_services", "awaiting_collection_letter"), true);
assert.equal(poaAdvanceAlreadyApplied("account_manager", "awaiting_collection_letter"), true);
assert.equal(poaAdvanceAlreadyApplied("client_services", "client_services"), false);
assert.equal(poaAdvanceAlreadyApplied("lead", "awaiting_collection_letter"), false);
assert.equal(shouldAttemptPoaAdvance("account_manager"), true);
assert.equal(shouldAttemptPoaAdvance("client_services"), true);
assert.equal(shouldAttemptPoaAdvance("awaiting_collection_letter"), false);
console.log("  ✓ POA auto-advance helpers only cover AM + CS");

assert.equal(hasCcAuthorizationOnRecord(["upload", "cc_authorization"]), true);
assert.equal(hasCcAuthorizationOnRecord(["poa_signed"]), false);
assert.equal(
  blockAdvanceFromAccountManagerWithoutCcAuth({
    fromStage: "account_manager",
    toStage: "client_services",
    hasCcAuthorization: false,
  }).blocked,
  true
);
assert.equal(
  blockAdvanceFromAccountManagerWithoutCcAuth({
    fromStage: "account_manager",
    toStage: "awaiting_collection_letter",
    hasCcAuthorization: false,
  }).blocked,
  true
);
assert.equal(
  blockAdvanceFromAccountManagerWithoutCcAuth({
    fromStage: "account_manager",
    toStage: "client_services",
    hasCcAuthorization: true,
  }).blocked,
  false
);
assert.equal(
  blockAdvanceFromAccountManagerWithoutCcAuth({
    fromStage: "account_manager",
    toStage: "dnc",
    hasCcAuthorization: false,
  }).blocked,
  false
);
assert.equal(
  blockAdvanceFromAccountManagerWithoutCcAuth({
    fromStage: "client_services",
    toStage: "awaiting_collection_letter",
    hasCcAuthorization: false,
  }).blocked,
  false
);
console.log("  ✓ Account Manager exit requires a signed CC authorization");

console.log("\nAll POA stage gate checks passed.");
