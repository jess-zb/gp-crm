/**
 * OpenSign eSign helpers — HMAC, stage gate, document type mapping.
 * Run: npm run test:esign
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyOpensignWebhookSignature } from "../lib/esign/hmac";
import {
  canShowEsignActions,
  documentTypeForKind,
  esignKindTitle,
  isDspWelcomePacket,
  isEsignKind,
  isUploadableEsignKind,
} from "../lib/esign/types";
import { valueForWidgetName, type EsignClientPrefill } from "../lib/esign/map-client-prefill";
import { flattenSignedPdf } from "../lib/esign/flatten-signed-pdf";
import { stampSignedFormPages, appendCertificatePages } from "../lib/esign/stamp-completed";
import { buildCertificatePdf } from "../lib/esign/certificate-pdf";
import { defaultLayoutForKind, valueForBind } from "../lib/esign/layout";
import {
  canPlaceEsignFields,
  canUseEsignStaffUi,
} from "../lib/esign/config";
import { formatUsd, formatUsdInput } from "../lib/esign/money";
import {
  formatAdvisorNameForEsign,
  missingRequiredReviewLabels,
  reviewFieldsForKind,
  snapshotFromReview,
  toTitleCaseName,
} from "../lib/esign/review-fields";
import { advisorFirstNameForPdf } from "../lib/packets/pdf-generator";
import { createOtpCode, hashOtp, otpMatches } from "../lib/esign/tokens";
import { DEFAULT_APP_URL, publicAppUrl } from "../lib/constants/business-contact";

console.log("E-Sign helper smoke test\n");

assert.equal(canShowEsignActions("welcome_packet"), true);
assert.equal(canShowEsignActions("client_services"), true);
assert.equal(canShowEsignActions("lead"), false);
assert.equal(canShowEsignActions(null), false);
assert.equal(canUseEsignStaffUi("dev"), true);
assert.equal(canUseEsignStaffUi("admin"), false);
assert.equal(canUseEsignStaffUi("admin", "cs@debtsupportpros.com"), true);
assert.equal(canUseEsignStaffUi("admin", "jessica@debtsupportpros.com"), true);
assert.equal(canUseEsignStaffUi("admin", "daniel@stellari.io"), true);
assert.equal(canUseEsignStaffUi("admin", "amanda@stellari.io"), true);
assert.equal(canUseEsignStaffUi("admin", "asim@voxtrongroup.com"), true);
assert.equal(canUseEsignStaffUi("admin", "someone@debtsupportpros.com"), false);
assert.equal(canUseEsignStaffUi("acct_manager"), false);
assert.equal(canPlaceEsignFields("dev"), true);
assert.equal(canPlaceEsignFields("admin"), false);
console.log("  ✓ buttons only in Account Manager");

assert.equal(documentTypeForKind("cc_authorization"), "cc_authorization");
assert.equal(documentTypeForKind("welcome_packet"), "poa_signed");
assert.equal(documentTypeForKind("ac_cc_authorization"), "cc_authorization");
assert.equal(documentTypeForKind("ac_welcome_packet"), "client_agreement");
assert.equal(isDspWelcomePacket("welcome_packet"), true);
assert.equal(isDspWelcomePacket("ac_welcome_packet"), false);
assert.equal(isEsignKind("welcome_packet"), true);
assert.equal(isEsignKind("ac_welcome_packet"), true);
assert.equal(isEsignKind("ac_cc_authorization"), true);
assert.equal(isUploadableEsignKind("ac_welcome_packet"), true);
assert.equal(isUploadableEsignKind("ac_cc_authorization"), true);
assert.equal(isUploadableEsignKind("welcome_packet"), false);
assert.equal(isUploadableEsignKind("cc_authorization"), false);
assert.equal(isEsignKind("client_agreement"), false);
assert.equal(esignKindTitle("ac_welcome_packet"), "Arlington Coaching Welcome Packet");
console.log("  ✓ Welcome Packet maps to signed POA");

const secret = "test-webhook-secret";
const body = JSON.stringify({ event: "completed", objectId: "abc" });
const good = createHmac("sha256", secret).update(body).digest("hex");
assert.equal(verifyOpensignWebhookSignature(body, good, secret), true);
assert.equal(verifyOpensignWebhookSignature(body, "deadbeef", secret), false);
assert.equal(verifyOpensignWebhookSignature(body, null, secret), false);
assert.equal(verifyOpensignWebhookSignature(body, good, ""), false);
console.log("  ✓ webhook HMAC accept/reject");

const sample: EsignClientPrefill = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "5551112222",
  street: "1 Main St",
  city: "Austin",
  state: "TX",
  zip: "78701",
  dateOfBirth: "1815-12-10",
  spouseName: "William",
  advisor: "Jordan",
  mid: "SUNSET",
  amountAuthorized: "150.00",
  card1Last4: "4242",
  card1Amount: "100.00",
  card2Last4: "1111",
  card2Amount: "50.00",
  card3Last4: "",
  card3Amount: "",
  card4Last4: "",
  card4Amount: "",
  card5Last4: "",
  card5Amount: "",
};
assert.equal(valueForWidgetName("First Name", sample), "Ada");
assert.equal(valueForWidgetName("email_address", sample), "ada@example.com");
assert.equal(valueForWidgetName("Zip Code", sample), "78701");
assert.equal(valueForWidgetName("Client Name", sample), "Ada Lovelace");
assert.equal(valueForWidgetName("Advisor", sample), "Jordan");
assert.equal(valueForWidgetName("Account Manager", sample), "Jordan");
assert.equal(valueForWidgetName("MID", sample), "SUNSET");
assert.equal(valueForWidgetName("Card 1 Last #", sample), "4242");
assert.equal(valueForWidgetName("Amount Authorized", sample), "$150.00");
assert.equal(valueForWidgetName("signature", sample), "");
console.log("  ✓ widget name aliases fill from the client file");

assert.ok(defaultLayoutForKind("cc_authorization").some((f) => f.bind === "signature"));
assert.ok(defaultLayoutForKind("welcome_packet").some((f) => f.bind === "fullName"));
assert.ok(defaultLayoutForKind("ac_welcome_packet").some((f) => f.bind === "signature"));
assert.ok(defaultLayoutForKind("ac_cc_authorization").some((f) => f.bind === "amountAuthorized"));
assert.deepEqual(
  reviewFieldsForKind("ac_welcome_packet")
    .filter((f) => f.required)
    .map((f) => f.key),
  ["fullName"]
);
assert.deepEqual(
  missingRequiredReviewLabels("ac_cc_authorization", { fullName: "Ada Lovelace" }),
  ["Charge amount"]
);
assert.deepEqual(
  missingRequiredReviewLabels("ac_cc_authorization", {
    fullName: "Ada Lovelace",
    amountAuthorized: "$150.00",
  }),
  []
);
assert.equal(formatUsd("1500"), "$1,500.00");
assert.equal(formatUsdInput("1500", true), "1,500.00");
assert.equal(formatUsdInput("1500.5", true), "1,500.50");
assert.equal(valueForBind("amountAuthorized", sample, "8/19/2026"), "$150.00");
assert.equal(valueForBind("card1Amount", sample, "8/19/2026"), "$100.00");
assert.equal(advisorFirstNameForPdf("Jessica Gonzales"), "Jessica");
assert.equal(advisorFirstNameForPdf("Jordan"), "Jordan");
console.log("  ✓ overlay maps for both forms");

const ccRequired = reviewFieldsForKind("cc_authorization")
  .filter((f) => f.required)
  .map((f) => f.key)
  .sort();
assert.deepEqual(ccRequired, [
  "advisor",
  "card1Amount",
  "card1Last4",
  "fullName",
  "mid",
].sort());
assert.deepEqual(
  reviewFieldsForKind("welcome_packet")
    .filter((f) => f.required)
    .map((f) => f.key),
  ["mid"]
);
assert.deepEqual(
  missingRequiredReviewLabels("cc_authorization", {
    fullName: "Ada Lovelace",
    advisor: "Jordan",
    mid: "SUNSET",
    card1Last4: "4242",
    card1Amount: "$100.00",
  }),
  []
);
assert.ok(
  missingRequiredReviewLabels("cc_authorization", { mid: "SUNSET" }).includes("Name")
);
assert.deepEqual(missingRequiredReviewLabels("welcome_packet", { mid: "" }), ["MID"]);
assert.deepEqual(missingRequiredReviewLabels("welcome_packet", { mid: "SUNSET" }), []);
assert.equal(toTitleCaseName("DAN ESIGN"), "Dan Esign");
assert.equal(toTitleCaseName("marissa porter"), "Marissa Porter");
assert.equal(toTitleCaseName("MARY-JANE o'brien"), "Mary-Jane O'Brien");
assert.equal(formatAdvisorNameForEsign("Marissa Porter"), "Marissa");
assert.equal(formatAdvisorNameForEsign("JESSICA GONZALES"), "Jessica");
assert.equal(snapshotFromReview({ advisor: "Marissa Porter" }).advisor, "Marissa");
console.log("  ✓ required review fields");

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function main() {
  const signed = await flattenSignedPdf({
    kind: "cc_authorization",
    prefill: sample,
    signaturePng: new Uint8Array(tinyPng),
    signedDate: "8/19/2026",
  });
  assert.ok(signed.length > 100);
  assert.equal(String.fromCharCode(...signed.slice(0, 5)), "%PDF-");
  const preview = await flattenSignedPdf({
    kind: "cc_authorization",
    prefill: sample,
    signedDate: "",
  });
  assert.ok(preview.length > 100);
  assert.equal(String.fromCharCode(...preview.slice(0, 5)), "%PDF-");
  console.log("  ✓ flatten CC Auth produces a PDF");

  const cert = await buildCertificatePdf({
    requestId: "00000000-0000-0000-0000-000000000001",
    documentName: "Credit Card Authorization",
    sha256: "abc",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    originatorName: "Ada",
    originatorEmail: "ada@example.com",
    signerName: "Ada Lovelace",
    signerEmail: "ada@example.com",
    viewedAt: new Date().toISOString(),
    viewedIp: "1.1.1.1",
    signedAt: new Date().toISOString(),
    signedIp: "1.1.1.1",
    certRef: "123456",
    signaturePng: new Uint8Array(tinyPng),
  });
  assert.equal(String.fromCharCode(...cert.slice(0, 5)), "%PDF-");
  const stamped = await stampSignedFormPages(signed, "123456");
  const packet = await appendCertificatePages(stamped, cert);
  assert.equal(String.fromCharCode(...packet.slice(0, 5)), "%PDF-");
  assert.ok(packet.length > stamped.length);
  console.log("  ✓ certificate PDF");

  const code = createOtpCode();
  assert.equal(code.length, 6);
  assert.equal(otpMatches(code, hashOtp(code)), true);
  assert.equal(otpMatches("000000", hashOtp(code)), false);
  console.log("  ✓ OTP hash verify");

  assert.equal(DEFAULT_APP_URL, "https://dspcrm.vercel.app");
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(publicAppUrl(), "https://dspcrm.vercel.app");
  process.env.NEXT_PUBLIC_APP_URL = "https://example.test/";
  assert.equal(publicAppUrl(), "https://example.test");
  if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  console.log("  ✓ public sign URL falls back to live CRM host");

  console.log("\nAll eSign checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
