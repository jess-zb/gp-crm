/**
 * E-sign helpers: stage gate, behaviour → document type, review fields, flatten.
 * Run: pnpm test:esign
 */
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
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
import { mergeSuggestedFields, suggestLayoutFields, type PdfTextItem } from "../lib/esign/suggest-fields";
import { extractPdfTextItems } from "../lib/esign/pdf-text";
import { canManageEsignTemplates, canUseEsignStaffUi } from "../lib/esign/config";
import { formatUsd, formatUsdInput } from "../lib/esign/money";
import {
  formatAdvisorNameForEsign,
  missingRequiredReviewLabels,
  reviewFieldsForTemplate,
  snapshotFromReview,
  splitCityStateZip,
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
  address: "1 Main St, Austin, TX 78701",
  cityStateZip: "Austin, TX 78701",
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
assert.equal(valueForBind("email", sample, "8/19/2026"), "ada@example.com");
assert.equal(valueForBind("address", { ...sample, address: "" }, "8/19/2026"), "1 Main St, Austin, TX 78701");
assert.equal(valueForBind("cityStateZip", { ...sample, cityStateZip: "" }, "8/19/2026"), "Austin, TX 78701");
assert.equal(valueForBind("street", sample, "8/19/2026"), "1 Main St");
assert.deepEqual(splitCityStateZip("Austin, TX 78701"), { city: "Austin", state: "TX", zip: "78701" });
assert.equal(snapshotFromReview({ email: "ada@example.com", fullName: "Ada Lovelace" }).email, "ada@example.com");
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

function textItem(text: string, xPct: number, yPct: number, wPct = 8): PdfTextItem {
  return { page: 0, text, xPct, yPct, wPct, hPct: 1.5 };
}

const suggested = suggestLayoutFields([
  textItem("Name:", 10, 12, 6),
  textItem("Please print your name on the line below.", 10, 20, 70),
  textItem("Your", 10, 26, 4),
  textItem("name", 15, 26, 5),
  textItem("here", 21, 26, 4),
  textItem("Date of Birth:", 10, 34, 14),
  textItem("Date:", 10, 80, 5),
  textItem("Address:", 10, 42, 8),
  textItem("City:", 10, 48, 5),
  textItem("Card 1 Amount:", 10, 60, 14),
  textItem("Name: __________", 10, 70, 40),
]);
const suggestedBinds = suggested.map((field) => field.bind);
assert.ok(suggestedBinds.includes("fullName"));
assert.equal(suggestedBinds.filter((bind) => bind === "fullName").length, 2);
assert.ok(suggested.find((field) => field.bind === "fullName" && field.yPct < 15)!.xPct > 15);
assert.ok(suggestedBinds.includes("dateOfBirth"));
assert.ok(suggestedBinds.includes("signedDate"));
assert.ok(suggestedBinds.includes("street"));
assert.equal(suggestedBinds.includes("address"), false);
assert.equal(suggestedBinds.includes("card1Amount"), false);
assert.equal(suggestedBinds.includes("amountAuthorized"), false);
const underscoreName = suggested.find((field) => field.bind === "fullName" && field.yPct > 60);
assert.ok(underscoreName);
assert.ok(underscoreName.xPct > 12 && underscoreName.xPct < 30);
assert.equal(mergeSuggestedFields(suggested, suggested).length, suggested.length);
const addressOnly = suggestLayoutFields([textItem("Address:", 10, 10, 8)]);
assert.deepEqual(addressOnly.map((field) => field.bind), ["address"]);

const stacked = suggestLayoutFields([
  textItem("CLIENT FULL NAME", 8, 28, 18),
  textItem("BILLING STREET ADDRESS", 8, 40, 22),
  textItem("CITY", 8, 50, 5),
  textItem("STATE", 51, 50, 6),
  textItem("ZIP CODE", 67, 50, 8),
  textItem("AUTHORIZED CHARGE AMOUNT ($)", 8, 60, 24),
  textItem("PAYMENT DATE", 52, 60, 12),
  textItem("CARDHOLDER SIGNATURE", 8, 80, 20),
  textItem("DATE", 70, 80, 5),
  textItem("I authorize the card listed above for the amount.", 8, 70, 70),
]);
const stackedBy = (bind: string) => stacked.find((field) => field.bind === bind);
const stackedName = stackedBy("fullName");
assert.ok(stackedName && stackedName.yPct > 28);
assert.ok(stackedBy("street"));
assert.ok(stackedBy("city"));
assert.ok(stackedBy("state"));
assert.ok(stackedBy("zip"));
assert.ok(stackedBy("amountAuthorized"));
assert.ok(stackedBy("signature"));
assert.ok(stackedBy("signedDate"));
assert.equal(stacked.filter((field) => field.bind === "signedDate").length, 1);
console.log("  ✓ general labels become field boxes; sentences and card lines do not");

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

  const form = await PDFDocument.create();
  const formPage = form.addPage([612, 792]);
  const font = await form.embedFont(StandardFonts.Helvetica);
  const formLines: [string, number, number][] = [
    ["Name:", 72, 700],
    ["Address:", 72, 660],
    ["City:", 72, 620],
    ["State:", 200, 620],
    ["ZIP:", 320, 620],
    ["Email:", 72, 580],
    ["Phone:", 72, 540],
    ["Date of Birth:", 72, 500],
    ["Please print your name on the line below.", 72, 460],
    ["Signature:", 72, 120],
    ["Date:", 360, 120],
  ];
  for (const [text, x, y] of formLines) {
    formPage.drawText(text, { x, y, size: 12, font });
  }
  const fromPdf = suggestLayoutFields(await extractPdfTextItems(await form.save()));
  const pdfBinds = fromPdf.map((field) => field.bind);
  assert.equal(pdfBinds.filter((bind) => bind === "fullName").length, 1);
  for (const bind of ["street", "city", "state", "zip", "email", "phone", "dateOfBirth", "signature", "signedDate"]) {
    assert.ok(pdfBinds.includes(bind), `missing ${bind}`);
  }
  assert.equal(pdfBinds.includes("address"), false);
  const nameBox = fromPdf.find((field) => field.bind === "fullName");
  assert.ok(nameBox && nameBox.xPct > 15 && nameBox.yPct < 20);
  console.log("  ✓ uploaded PDF text places general fields");

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
