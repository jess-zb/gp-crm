/**
 * Smoke test — POA stage gate must match checklist signals (document on file OR poa_signed_at).
 * Run: npm run test:stage-poa-gate
 */
import assert from "node:assert/strict";
import { blockAdvanceFromClientServicesWithoutPoa } from "../lib/workflow/stage-blockers";
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
assert.equal(poaAdvanceAlreadyApplied("welcome_packet", "awaiting_collection_letter"), true);
assert.equal(poaAdvanceAlreadyApplied("client_services", "client_services"), false);
assert.equal(poaAdvanceAlreadyApplied("lead", "awaiting_collection_letter"), false);
assert.equal(shouldAttemptPoaAdvance("welcome_packet"), true);
assert.equal(shouldAttemptPoaAdvance("client_services"), true);
assert.equal(shouldAttemptPoaAdvance("awaiting_collection_letter"), false);
console.log("  ✓ POA auto-advance helpers only cover AM + CS");

console.log("\nAll POA stage gate checks passed.");
