export const ESIGN_STATUSES = [
  "sent",
  "viewed",
  "signed",
  "completed",
  "declined",
  "revoked",
  "failed",
  "superseded",
] as const;
export type EsignStatus = (typeof ESIGN_STATUSES)[number];

/**
 * What a signed document *does*. Behaviour is a closed list because it drives
 * automation; the set of documents attached to it is open and staff-managed.
 */
export const ESIGN_BEHAVIORS = [
  "cc_authorization",
  "welcome_packet",
  "agreement",
  "other",
] as const;
export type EsignBehavior = (typeof ESIGN_BEHAVIORS)[number];

export function isEsignBehavior(value: string): value is EsignBehavior {
  return (ESIGN_BEHAVIORS as readonly string[]).includes(value);
}

export const ESIGN_BEHAVIOR_LABELS: Record<EsignBehavior, string> = {
  cc_authorization: "Credit card authorization",
  welcome_packet: "Welcome packet (advances the client once signed)",
  agreement: "Agreement",
  other: "Other",
};

/** documents.document_type the signed copy is filed under, per behaviour. */
export function documentTypeForBehavior(behavior: string): string {
  if (behavior === "welcome_packet") return "poa_signed";
  if (behavior === "cc_authorization") return "cc_authorization";
  return "client_agreement";
}

/**
 * Binds Confirm Before Sending treats as required for a new template. Staff can
 * change this in the field editor; a bind only blocks send once it is placed.
 */
export function defaultRequiredBinds(behavior: string): string[] {
  if (behavior === "welcome_packet") return ["mid"];
  if (behavior === "cc_authorization") {
    return ["fullName", "advisor", "mid", "card1Last4", "card1Amount"];
  }
  return [];
}

export type EsignTemplateRow = {
  id: string;
  mid_id: string;
  name: string;
  hint: string | null;
  behavior: EsignBehavior;
  document_type: string;
  storage_path: string;
  page_count: number | null;
  fields: unknown;
  required_binds: string[];
  is_active: boolean;
  sort_order: number;
};

export const ESIGN_TEMPLATE_SELECT =
  "id, mid_id, name, hint, behavior, document_type, storage_path, page_count, fields, required_binds, is_active, sort_order";

/** Card shown on the client profile. No layout or storage detail. */
export type EsignTemplateCard = {
  id: string;
  name: string;
  hint: string | null;
  behavior: EsignBehavior;
};

export type EsignRequestRow = {
  id: string;
  client_id: string;
  template_id: string | null;
  template_name: string | null;
  behavior: string | null;
  status: EsignStatus;
  signer_email: string;
  signer_name: string;
  sent_by: string | null;
  sent_at: string;
  completed_at: string | null;
  signed_document_id: string | null;
  certificate_document_id: string | null;
  last_error: string | null;
};

export const ESIGN_REQUEST_SELECT =
  "id, client_id, template_id, template_name, behavior, status, signer_email, signer_name, sent_by, sent_at, completed_at, signed_document_id, certificate_document_id, last_error";

/** Filename stem for the signed copy on Uploads. */
export function esignSignedFileStem(templateName: string): string {
  const slug = templateName
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "Signed-Document";
}

export function esignSentAuditAction(behavior: string): string {
  return `esign_${behavior}_sent`;
}

/** Signing a welcome packet files a POA, which advances the stage. */
export function advancesStageOnSign(behavior: string): boolean {
  return behavior === "welcome_packet";
}

export function canShowEsignActions(stage: string | null | undefined): boolean {
  const s = (stage ?? "").trim();
  return s === "welcome_packet" || s === "client_services";
}
