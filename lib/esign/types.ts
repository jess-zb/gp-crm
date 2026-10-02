export const ESIGN_KINDS = [
  "cc_authorization",
  "welcome_packet",
  "ac_cc_authorization",
  "ac_welcome_packet",
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

/** Qualified staff may replace these blank forms from the E-Sign section. */
export function isUploadableEsignKind(
  value: string
): value is "ac_cc_authorization" | "ac_welcome_packet" {
  return value === "ac_cc_authorization" || value === "ac_welcome_packet";
}

export function esignKindTitle(kind: EsignKind): string {
  switch (kind) {
    case "welcome_packet":
      return "Virtual Welcome Packet";
    case "ac_welcome_packet":
      return "Arlington Coaching Welcome Packet";
    case "ac_cc_authorization":
      return "Arlington Coaching Credit Card Authorization";
    case "cc_authorization":
      return "Credit Card Authorization";
  }
}

export function esignSignedFileStem(kind: EsignKind): string {
  switch (kind) {
    case "welcome_packet":
      return "Virtual-Welcome-Packet";
    case "ac_welcome_packet":
      return "Arlington-Coaching-Welcome-Packet";
    case "ac_cc_authorization":
      return "Arlington-Coaching-CC-Authorization";
    case "cc_authorization":
      return "CC-Authorization";
  }
}

export function esignSentAuditAction(kind: EsignKind): string {
  switch (kind) {
    case "welcome_packet":
      return "esign_welcome_packet_sent";
    case "ac_welcome_packet":
      return "esign_ac_welcome_packet_sent";
    case "ac_cc_authorization":
      return "esign_ac_cc_auth_sent";
    case "cc_authorization":
      return "esign_cc_auth_sent";
  }
}

/** DSP Virtual Welcome Packet only. Arlington Coaching does not print or advance stage. */
export function isDspWelcomePacket(kind: EsignKind): boolean {
  return kind === "welcome_packet";
}

export function documentTypeForKind(
  kind: EsignKind
): "cc_authorization" | "poa_signed" | "client_agreement" {
  if (kind === "welcome_packet") return "poa_signed";
  if (kind === "ac_welcome_packet") return "client_agreement";
  return "cc_authorization";
}

export function canShowEsignActions(stage: string | null | undefined): boolean {
  const s = (stage ?? "").trim();
  return s === "welcome_packet" || s === "client_services";
}
