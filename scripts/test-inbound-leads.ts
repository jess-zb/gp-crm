/**
 * Partner lead payload and API-key checks. No database.
 * Run: npm run test:inbound-leads
 */
import assert from "node:assert/strict";
import { parseInboundLead, sameUsPhone } from "../lib/leads/parse-inbound-lead";
import { parsePartnerExport, partnerExportFileName } from "../lib/leads/parse-partner-export";
import { verifyLeadsApiKey } from "../lib/leads/verify-leads-api-key";

console.log("Inbound lead API smoke test\n");

const valid = parseInboundLead({
  first_name: "Jane",
  last_name: "Doe",
  phone: "(555) 123-4567",
  street_address: "123 Main St",
  city: "Miami",
  state: "Florida",
  zip: "33101-1234",
});
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.lead.phone, "5551234567");
  assert.equal(valid.lead.state, "FL");
  assert.equal(valid.lead.zip_code, "33101-1234");
  assert.equal(valid.lead.email, null);
  assert.equal(valid.lead.source, "Partner API");
}
console.log("  ✓ required fields, formatted phone, full state name, ZIP+4");

const caps = parseInboundLead({
  first_name: "MARY-JANE",
  last_name: "O'BRIEN",
  phone: "5551234567",
  street_address: "5637 LEBANON AVE",
  city: "PHILADELPHIA",
  state: "pa",
  zip: "19131",
  email: "JANE@EXAMPLE.COM",
});
assert.equal(caps.ok, true);
if (caps.ok) {
  assert.equal(caps.lead.first_name, "Mary-Jane");
  assert.equal(caps.lead.last_name, "O'Brien");
  assert.equal(caps.lead.street_address, "5637 Lebanon Ave");
  assert.equal(caps.lead.city, "Philadelphia");
  assert.equal(caps.lead.state, "PA");
  assert.equal(caps.lead.email, "jane@example.com");
  assert.equal(caps.lead.phone, "5551234567");
}
console.log("  ✓ all-caps names and streets are stored in Title Case");

const camel = parseInboundLead({
  firstName: "Ann",
  lastName: "Lee",
  phoneNumber: "1-555-999-0000",
  streetAddress: "9 Oak Ave",
  city: "Austin",
  state: "tx",
  zipCode: "78701",
  email: "ann@example.com",
  source: "Northwind CRM",
});
assert.equal(camel.ok, true);
if (camel.ok) {
  assert.equal(camel.lead.phone, "5559990000");
  assert.equal(camel.lead.state, "TX");
  assert.equal(camel.lead.email, "ann@example.com");
  assert.equal(camel.lead.source, "Northwind CRM");
}
console.log("  ✓ camelCase aliases, leading 1, optional email and source");

const missing = parseInboundLead({ first_name: "Jane" });
assert.equal(missing.ok, false);
if (!missing.ok) {
  assert.ok(missing.fields.last_name);
  assert.ok(missing.fields.phone);
  assert.ok(missing.fields.street_address);
  assert.ok(missing.fields.city);
  assert.ok(missing.fields.state);
  assert.ok(missing.fields.zip);
}
console.log("  ✓ missing fields are named");

const bad = parseInboundLead({
  first_name: "Jane",
  last_name: "Doe",
  phone: "555",
  street_address: "123 Main St",
  city: "Miami",
  state: "ZZ",
  zip: "331",
  email: "not-an-email",
});
assert.equal(bad.ok, false);
if (!bad.ok) {
  assert.match(bad.fields.phone ?? "", /10-digit/);
  assert.match(bad.fields.state ?? "", /abbreviation/);
  assert.match(bad.fields.zip ?? "", /5 digits/);
  assert.match(bad.fields.email ?? "", /valid/);
}
console.log("  ✓ bad phone, state, ZIP, and email");

assert.equal(sameUsPhone("(555) 123-4567", "5551234567"), true);
assert.equal(sameUsPhone("15551234567", "5551234567"), true);
assert.equal(sameUsPhone("5551234568", "5551234567"), false);
console.log("  ✓ duplicate phone match ignores formatting");

const key = "gp_live_test_key_value";
process.env.LEADS_API_KEY = key;
assert.equal(
  verifyLeadsApiKey(new Request("https://example.com/api/leads", { headers: { authorization: `Bearer ${key}` } })),
  "ok"
);
assert.equal(
  verifyLeadsApiKey(new Request("https://example.com/api/leads", { headers: { "x-api-key": key } })),
  "ok"
);
assert.equal(
  verifyLeadsApiKey(new Request("https://example.com/api/leads", { headers: { authorization: "Bearer wrong" } })),
  "unauthorized"
);
delete process.env.LEADS_API_KEY;
assert.equal(verifyLeadsApiKey(new Request("https://example.com/api/leads")), "missing");
console.log("  ✓ API key: bearer, X-Api-Key, reject, unset");

const EXPORT = `First name : JANE
Last name : DOE
Phone : (555) 010-0199
Secondary Phones : 
5550100199
5550100200
Street name : 1 TEST STREET
City : MIAMI
State : FL
Zip : 33101

Secondary Addresses : 

Social security : 123456789
Date of birth : 01/12/1940
MMN : DOE " SMITH "
Email : JANE@EXAMPLE.COM

BANKING: 
Charge on this card : 100
Charge Card : Yes
NOC : JANE Q DOE
Bank Name : EXAMPLE BANK
Exp : 06/29
Card # : 4111-1111-1111-1111
CVV/CVV (First CVV) : 777
Balance : 500
Available : 100
POA : no

Charge on this card : 50
NOC : JANE DOE
Bank Name : CAP ONE MASTER
Card # : 5480-0000-0000-0484
CVV/CVV (First CVV) : 321
POA : no

Total Cards : 2
Total Debt : 150
Total Charge : 150
Agent  : CASEY AGENT (NORTHWIND)
TO  : Riley Chen

MetaData: 
BANKING : WELLS FARGO 
PRE : PRE PERSON 
CLOSER : CLOSER PERSON

CALL BACK BEFORE 12
PASWORD HOME5637
`;

const exported = parsePartnerExport(EXPORT);
assert.equal(exported.ok, true);
if (exported.ok) {
  assert.equal(exported.lead.first_name, "Jane");
  assert.equal(exported.lead.last_name, "Doe");
  assert.equal(exported.lead.phone, "5550100199");
  assert.equal(exported.lead.phone_home, "5550100200");
  assert.equal(exported.lead.street_address, "1 Test Street");
  assert.equal(exported.lead.city, "Miami");
  assert.equal(exported.lead.state, "FL");
  assert.equal(exported.lead.email, "jane@example.com");
  const packed = JSON.stringify(exported.lead);
  assert.equal(packed.includes("4111111111111111"), false);
  assert.equal(packed.includes("123456789"), false);
  assert.equal(packed.includes("HOME5637"), false);
  assert.equal(partnerExportFileName("Jane", "Doe", "JANE DOE.txt"), "Jane Doe.txt");
}
const again = parsePartnerExport(EXPORT);
assert.equal(again.ok, true);
console.log("  ✓ partner text keeps contact fields only; a repeat still parses as its own lead");

console.log("\nAll inbound lead checks passed.");
