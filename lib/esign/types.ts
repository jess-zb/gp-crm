export const ESIGN_KINDS = [
  "cc_authorization",
  "welcome_packet",
] as const;
export type EsignKind = (typeof ESIGN_KINDS)[number];

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

export type EsignRequestRow = {
  id: string;
  client_id: string;
  kind: EsignKind;
  opensign_document_id: string;
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

export function isEsignKind(value: string): value is EsignKind {
  return (ESIGN_KINDS as readonly string[]).includes(value);
}

/** Qualified staff may replace the blank form from the E-Sign section. */
export function isUploadableEsignKind(value: string): value is EsignKind {
  return isEsignKind(value);
}

export function esignKindTitle(kind: EsignKind): string {
  switch (kind) {
    case "welcome_packet":
      return "Welcome Packet";
    case "cc_authorization":
      return "Credit Card Authorization";
  }
}

export function esignSignedFileStem(kind: EsignKind): string {
  switch (kind) {
    case "welcome_packet":
      return "Welcome-Packet";
    case "cc_authorization":
      return "CC-Authorization";
  }
}

export function esignSentAuditAction(kind: EsignKind): string {
  switch (kind) {
    case "welcome_packet":
      return "esign_welcome_packet_sent";
    case "cc_authorization":
      return "esign_cc_auth_sent";
  }
}

export function documentTypeForKind(
  kind: EsignKind
): "cc_authorization" | "poa_signed" {
  if (kind === "welcome_packet") return "poa_signed";
  return "cc_authorization";
}

export function canShowEsignActions(stage: string | null | undefined): boolean {
  const s = (stage ?? "").trim();
  return s === "welcome_packet" || s === "client_services";
}
