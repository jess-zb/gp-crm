import { toTitleCaseName } from "@/lib/esign/review-fields";
import { normalizeUsState } from "@/lib/leads/us-states";

export type InboundLead = {
  first_name: string;
  last_name: string;
  /** Ten digits, no formatting. */
  phone: string;
  street_address: string;
  city: string;
  state: string;
  /** Five digits, or ZIP+4 as 12345-6789. */
  zip_code: string;
  email: string | null;
  /** Shown to staff as the lead source. */
  source: string;
};

export type InboundLeadFields = Partial<
  Record<
    | "first_name"
    | "last_name"
    | "phone"
    | "street_address"
    | "city"
    | "state"
    | "zip"
    | "email"
    | "source",
    string
  >
>;

export type ParseInboundLeadResult =
  | { ok: true; lead: InboundLead }
  | { ok: false; fields: InboundLeadFields };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SOURCE = "Partner API";

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function pick(body: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function digits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function phoneDigits(raw: string): string | null {
  let d = digits(raw);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? d : null;
}

function zipCode(raw: string): string | null {
  const d = digits(raw);
  if (d.length === 5) return d;
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return null;
}

/**
 * Normalize a partner POST body into the client columns this CRM already stores.
 * Accepts snake_case and camelCase. Email and source are optional.
 */
export function parseInboundLead(body: unknown): ParseInboundLeadResult {
  const record = asRecord(body);
  if (!record) {
    return { ok: false, fields: { first_name: "Send a JSON object." } };
  }

  const fields: InboundLeadFields = {};
  const first_name = pick(record, ["first_name", "firstName", "first"]);
  const last_name = pick(record, ["last_name", "lastName", "last"]);
  const phoneRaw = pick(record, ["phone", "phone_number", "phoneNumber", "mobile"]);
  const street_address = pick(record, [
    "street_address",
    "streetAddress",
    "street",
    "address",
  ]);
  const city = pick(record, ["city"]);
  const stateRaw = pick(record, ["state"]);
  const zipRaw = pick(record, ["zip", "zip_code", "zipCode", "postal_code", "postalCode"]);
  const emailRaw = pick(record, ["email"]);
  const sourceRaw = pick(record, ["source"]);

  if (!first_name) fields.first_name = "First name is required.";
  else if (first_name.length > 80) fields.first_name = "First name must be 80 characters or fewer.";

  if (!last_name) fields.last_name = "Last name is required.";
  else if (last_name.length > 80) fields.last_name = "Last name must be 80 characters or fewer.";

  const phone = phoneDigits(phoneRaw);
  if (!phone) fields.phone = "Phone must be a 10-digit US number.";

  if (!street_address) fields.street_address = "Street address is required.";
  else if (street_address.length > 200) {
    fields.street_address = "Street address must be 200 characters or fewer.";
  }

  if (!city) fields.city = "City is required.";
  else if (city.length > 80) fields.city = "City must be 80 characters or fewer.";

  const state = stateRaw ? normalizeUsState(stateRaw) : null;
  if (!state) fields.state = "State must be a US state abbreviation, such as FL.";

  const zip_code = zipRaw ? zipCode(zipRaw) : null;
  if (!zip_code) fields.zip = "ZIP must be 5 digits, or 9 digits for ZIP+4.";

  let email: string | null = null;
  if (emailRaw) {
    const normalizedEmail = emailRaw.toLowerCase();
    if (normalizedEmail.length > 200 || !EMAIL_RE.test(normalizedEmail)) {
      fields.email = "Email must be a valid address.";
    } else {
      email = normalizedEmail;
    }
  }

  let source = DEFAULT_SOURCE;
  if (sourceRaw) {
    const cleaned = sourceRaw.replace(/[\u0000-\u001F]/g, "").trim();
    if (!cleaned || cleaned.length > 80) {
      fields.source = "Source must be 80 characters or fewer.";
    } else {
      source = cleaned;
    }
  }

  if (Object.keys(fields).length > 0 || !phone || !state || !zip_code) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    lead: {
      first_name: toTitleCaseName(first_name),
      last_name: toTitleCaseName(last_name),
      phone,
      street_address: toTitleCaseName(street_address),
      city: toTitleCaseName(city),
      state,
      zip_code,
      email,
      source,
    },
  };
}

/** True when a stored phone is the same 10-digit US number. */
export function sameUsPhone(stored: string | null | undefined, digits10: string): boolean {
  let d = digits(stored ?? "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d === digits10;
}
