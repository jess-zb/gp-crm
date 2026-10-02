import { isPoaDocumentType } from "@/lib/clients/poa-upload-advance";
import { publicAppUrl } from "@/lib/constants/business-contact";

export const ATTORNEY_BATCH_TOKEN_HEX_LENGTH = 64;
export const ATTORNEY_BATCH_DEFAULT_EXPIRY_DAYS = 30;

export function isAttorneyBatchToken(token: string): boolean {
  return (
    token.length === ATTORNEY_BATCH_TOKEN_HEX_LENGTH &&
    /^[0-9a-f]{64}$/i.test(token)
  );
}

export function attorneyBatchPublicPath(token: string): string {
  return `/attorney-batch/${token}`;
}

export function appBaseUrl(): string {
  return publicAppUrl();
}

export function attorneyBatchPublicUrl(token: string): string {
  return `${appBaseUrl()}${attorneyBatchPublicPath(token)}`;
}

export function isAttorneyBatchEligibleDocument(doc: {
  document_type: string | null;
  is_collection_letter?: boolean | null;
}): boolean {
  const type = (doc.document_type ?? "").trim().toLowerCase();
  if (doc.is_collection_letter) return true;
  if (type === "collection_letter") return true;
  return isPoaDocumentType(type);
}

export function attorneyBatchDocKind(doc: {
  document_type: string | null;
  is_collection_letter?: boolean | null;
}): "poa" | "collection_letter" | "other" {
  const type = (doc.document_type ?? "").trim().toLowerCase();
  if (doc.is_collection_letter || type === "collection_letter") {
    return "collection_letter";
  }
  if (isPoaDocumentType(type)) return "poa";
  return "other";
}
