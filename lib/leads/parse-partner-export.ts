import { toTitleCaseName } from "@/lib/esign/review-fields";
import { parseInboundLead, type InboundLeadFields } from "@/lib/leads/parse-inbound-lead";

/** Contact fields copied onto the lead. Everything else stays in the text file. */
export type PartnerExport = {
  first_name: string;
  last_name: string;
  phone: string;
  /** Set only when a secondary phone is a different 10-digit number. */
  phone_home: string | null;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  email: string;
  source: string;
};

export type ParsePartnerExportResult =
  | { ok: true; lead: PartnerExport }
  | { ok: false; fields: InboundLeadFields };

function splitLabel(line: string): { label: string | null; value: string } {
  const idx = line.indexOf(":");
  if (idx === -1) return { label: null, value: line.trim() };
  const label = line.slice(0, idx).trim().toLowerCase().replace(/\s+/g, " ");
  const value = line.slice(idx + 1).trim();
  if (!label || label.length > 40) return { label: null, value: line.trim() };
  return { label, value };
}

function phoneDigits(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? d : null;
}

/**
 * Read name, phones, address, and email from the partner's downloaded text.
 * Banking and the rest of the file are ignored here; the original text is stored as-is.
 */
export function parsePartnerExport(
  text: string,
  source?: string | null
): ParsePartnerExportResult {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const header: Record<string, string> = {};
  const secondaryPhones: string[] = [];
  let followPhones = false;

  for (const rawLine of lines) {
    const { label, value } = splitLabel(rawLine);
    if (label === "banking" || label === "metadata") break;

    if (!label && !value) {
      followPhones = false;
      continue;
    }

    if (label === "secondary phones" || label === "secondary phone") {
      if (value) secondaryPhones.push(value);
      followPhones = true;
      continue;
    }
    if (!label && followPhones) {
      secondaryPhones.push(value);
      continue;
    }
    followPhones = false;
    if (label && value && !(label in header)) header[label] = value;
  }

  const core = parseInboundLead({
    first_name: header["first name"] ?? "",
    last_name: header["last name"] ?? "",
    phone: header.phone ?? "",
    street_address: header["street name"] || header["street address"] || header.street || "",
    city: header.city ?? "",
    state: header.state ?? "",
    zip: header.zip || header["zip code"] || "",
    email: (header.email ?? "").toLowerCase(),
    source: source ?? undefined,
  });
  if (!core.ok) return core;
  if (!core.lead.email) {
    return { ok: false, fields: { email: "Email is required." } };
  }

  const primary = core.lead.phone;
  const phone_home =
    secondaryPhones
      .map((phone) => phoneDigits(phone))
      .find((phone): phone is string => Boolean(phone && phone !== primary)) ?? null;

  return {
    ok: true,
    lead: {
      first_name: core.lead.first_name,
      last_name: core.lead.last_name,
      phone: primary,
      phone_home,
      street_address: core.lead.street_address,
      city: core.lead.city,
      state: core.lead.state,
      zip_code: core.lead.zip_code,
      email: core.lead.email,
      source: core.lead.source,
    },
  };
}

/** Document name in Title Case, such as `Gloria Weaver.txt`. */
export function partnerExportFileName(
  first: string,
  last: string,
  provided?: string | null
): string {
  const base = provided?.split(/[/\\]/).pop()?.trim() ?? "";
  const cleaned = base.replace(/[^\w.\- ]+/g, "").replace(/\.txt$/i, "").trim();
  const stem = toTitleCaseName(cleaned || `${first} ${last}`);
  const safe = stem.replace(/[^\w.\- ]+/g, "").trim();
  return `${safe || "Partner Export"}.txt`;
}
