/**
 * E-sign helpers: stage gate, behaviour → document type, review fields, flatten.
 * Run: pnpm test:esign
 */
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  advancesStageOnSign,
  canShowEsignActions,
  documentTypeForBehavior,
  esignSignedFileStem,
  isEsignBehavior,
} from "../lib/esign/types";
import { valueForWidgetName, type EsignClientPrefill } from "../lib/esign/map-client-prefill";
import { flattenSignedPdf } from "../lib/esign/flatten-signed-pdf";
import { stampSignedFormPages, appendCertificatePages } from "../lib/esign/stamp-completed";
import { buildCertificatePdf } from "../lib/esign/certificate-pdf";
import { valueForBind } from "../lib/esign/layout";
import { canManageEsignTemplates, canUseEsignStaffUi } from "../lib/esign/config";
import { formatUsd, formatUsdInput } from "../lib/esign/money";
import {
  formatAdvisorNameForEsign,
  missingRequiredReviewLabels,
  reviewFieldsForTemplate,
  snapshotFromReview,
  toTitleCaseName,
} from "../lib/esign/review-fields";
import { createOtpCode, hashOtp, otpMatches } from "../lib/esign/tokens";
import { DEFAULT_APP_URL, publicAppUrl } from "../lib/constants/business-contact";

console.log("E-Sign helper smoke test\n");

assert.equal(canShowEsignActions("account_manager"), true);
assert.equal(canShowEsignActions("client_services"), true);
assert.equal(canShowEsignActions("lead"), false);
assert.equal(canShowEsignActions(null), false);
assert.equal(canUseEsignStaffUi("dev"), true);
assert.equal(canUseEsignStaffUi("admin"), true);
assert.equal(canUseEsignStaffUi("acct_manager"), true);
assert.equal(canUseEsignStaffUi("attorney"), false);
assert.equal(canUseEsignStaffUi("client"), false);
assert.equal(canManageEsignTemplates("dev"), true);
assert.equal(canManageEsignTemplates("admin"), true);
assert.equal(canManageEsignTemplates("acct_manager"), false);
console.log("  ✓ every CRM staff role can send; leadership manages templates");

assert.equal(documentTypeForBehavior("cc_authorization"), "cc_authorization");
assert.equal(documentTypeForBehavior("welcome_packet"), "poa_signed");
assert.equal(documentTypeForBehavior("agreement"), "client_agreement");
assert.equal(documentTypeForBehavior("other"), "client_agreement");
assert.equal(isEsignBehavior("welcome_packet"), true);
assert.equal(isEsignBehavior("client_agreement"), false);
assert.equal(advancesStageOnSign("welcome_packet"), true);
assert.equal(advancesStageOnSign("cc_authorization"), false);
assert.equal(esignSignedFileStem("Welcome Packet"), "Welcome-Packet");
console.log("  ✓ behaviour maps to the filed document type");

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
  mid: "Golden Pathway",
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
assert.equal(valueForWidgetName("MID", sample), "Golden Pathway");
assert.equal(valueForWidgetName("Card 1 Last #", sample), "4242");
assert.equal(valueForWidgetName("Amount Authorized", sample), "$150.00");
assert.equal(valueForWidgetName("signature", sample), "");
console.log("  ✓ widget name aliases fill from the client file");

const box = (id: string, bind: string) => ({
  id,
  bind,
  page: 0,
  xPct: 10,
  yPct: 10,
  wPct: 30,
  hPct: 2,
});

const welcomeTemplate = {
  fields: [box("n", "fullName"), box("m", "mid"), box("s", "signature")],
  required_binds: ["mid"],
};
const ccTemplate = {
  fields: [
    box("n", "fullName"),
    box("a", "advisor"),
    box("m", "mid"),
    box("c4", "card1Last4"),
    box("ca", "card1Amount"),
    box("amt", "amountAuthorized"),
    box("s", "signature"),
  ],
  required_binds: ["fullName", "advisor", "mid", "card1Last4", "card1Amount"],
};

assert.deepEqual(
  reviewFieldsForTemplate(welcomeTemplate)
    .filter((f) => f.required)
    .map((f) => f.key),
  ["mid"]
);
assert.deepEqual(
  missingRequiredReviewLabels(welcomeTemplate, { fullName: "Ada Lovelace" }),
  ["MID"]
);
assert.deepEqual(
  missingRequiredReviewLabels(welcomeTemplate, {
    fullName: "Ada Lovelace",
    mid: "Golden Pathway",
  }),
  []
);
assert.equal(formatUsd("1500"), "$1,500.00");
assert.equal(formatUsdInput("1500", true), "1,500.00");
assert.equal(formatUsdInput("1500.5", true), "1,500.50");
assert.equal(valueForBind("amountAuthorized", sample, "8/19/2026"), "$150.00");
assert.equal(valueForBind("card1Amount", sample, "8/19/2026"), "$100.00");
assert.equal(formatAdvisorNameForEsign("JESSICA GONZALES"), "Jessica");
assert.equal(formatAdvisorNameForEsign("jordan"), "Jordan");
console.log("  ✓ review fields come from the placed boxes");

const ccRequired = reviewFieldsForTemplate(ccTemplate)
  .filter((f) => f.required)
  .map((f) => f.key)
  .sort();
assert.deepEqual(ccRequired, ["advisor", "card1Amount", "card1Last4", "fullName", "mid"].sort());
assert.deepEqual(
  missingRequiredReviewLabels(ccTemplate, {
    fullName: "Ada Lovelace",
    advisor: "Jordan",
    mid: "Golden Pathway",
    card1Last4: "4242",
    card1Amount: "$100.00",
  }),
  []
);
assert.ok(missingRequiredReviewLabels(ccTemplate, { mid: "Golden Pathway" }).includes("Name"));
assert.deepEqual(missingRequiredReviewLabels(welcomeTemplate, { mid: "" }), ["MID"]);
assert.equal(toTitleCaseName("DAN ESIGN"), "Dan Esign");
assert.equal(toTitleCaseName("marissa porter"), "Marissa Porter");
assert.equal(toTitleCaseName("MARY-JANE o'brien"), "Mary-Jane O'Brien");
assert.equal(formatAdvisorNameForEsign("Marissa Porter"), "Marissa");
assert.equal(snapshotFromReview({ advisor: "Marissa Porter" }).advisor, "Marissa");
console.log("  ✓ required review fields");

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function main() {
  const blank = await PDFDocument.create();
  blank.addPage();
  const sourcePdf = await blank.save();
  const fields = [
    { id: "sig", bind: "signature" as const, page: 0, xPct: 10, yPct: 70, wPct: 40, hPct: 6 },
    { id: "name", bind: "fullName" as const, page: 0, xPct: 10, yPct: 20, wPct: 40, hPct: 3 },
  ];
  const signed = await flattenSignedPdf({
    sourcePdf,
    prefill: sample,
    signaturePng: new Uint8Array(tinyPng),
    signedDate: "8/19/2026",
    fields,
  });
  assert.ok(signed.length > 100);
  assert.equal(String.fromCharCode(...signed.slice(0, 5)), "%PDF-");
  const preview = await flattenSignedPdf({
    sourcePdf,
    prefill: sample,
    signedDate: "",
    fields,
  });
  assert.ok(preview.length > 100);
  assert.equal(String.fromCharCode(...preview.slice(0, 5)), "%PDF-");
  console.log("  ✓ flatten stamps a PDF from bytes, not a bundled file");

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

  assert.match(DEFAULT_APP_URL, /^https:\/\/[^/]+$/);
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(publicAppUrl(), DEFAULT_APP_URL);
  process.env.NEXT_PUBLIC_APP_URL = "https://example.test/";
  assert.equal(publicAppUrl(), "https://example.test");
  if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  console.log("  ✓ public sign URL falls back to the configured host");

  console.log("\nAll eSign checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
