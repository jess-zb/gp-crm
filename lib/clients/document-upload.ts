/** Shared client document upload helpers (API route + server actions). */

/** Upload modal values — must match Postgres enum document_type (see verify script). */
export const UI_DOCUMENT_TYPE_VALUES = [
  "upload",
  "cc_authorization",
  "audio_recording",
  "poa_document",
  "correspondence",
  "screenshot",
  "collection_letter",
  "other",
] as const;

export type UiDocumentType = (typeof UI_DOCUMENT_TYPE_VALUES)[number];

const UI_DOCUMENT_TYPE_LABELS: Record<UiDocumentType, string> = {
  upload: "Enrolled Cards",
  cc_authorization: "CC Authorization",
  audio_recording: "Audio Recording",
  poa_document: "POA File",
  correspondence: "Correspondence",
  screenshot: "Screenshot",
  collection_letter: "Collection Letter",
  other: "Other",
};

export const DOCUMENT_TYPE_OPTIONS: { value: UiDocumentType; label: string }[] =
  UI_DOCUMENT_TYPE_VALUES.map((value) => ({
    value,
    label: UI_DOCUMENT_TYPE_LABELS[value],
  }));

/**
 * Labels for every `document_type` enum value, not just the subset offered in the
 * upload modal. Legacy POA aliases are included because older rows store `poa`,
 * `poa_signed`, or `power_of_attorney`.
 */
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  ...UI_DOCUMENT_TYPE_LABELS,
  government_id: "Government ID",
  utility_bill: "Utility Bill",
  social_security_card: "Social Security Card",
  client_agreement: "Client Agreement",
  poa: "POA File",
  poa_signed: "POA File",
  power_of_attorney: "POA File",
};

const LOCKED_DOCUMENT_TYPES = new Set([
  "collection_letter",
  "poa_document",
  "poa",
  "poa_signed",
  "power_of_attorney",
]);

/** Collection letters and POA files cannot be deleted. */
export function isPermanentClientDocument(doc: {
  document_type?: string | null;
  is_collection_letter?: boolean | null;
}): boolean {
  if (doc.is_collection_letter === true) return true;
  return LOCKED_DOCUMENT_TYPES.has((doc.document_type ?? "").trim().toLowerCase());
}

export const PERMANENT_DOCUMENT_DELETE_ERROR =
  "Collection letters and POA files cannot be deleted.";

/**
 * Single source of truth for how a stored document type is displayed. Every
 * surface (Uploads tab, upload modal, attorney portal, client portal, activity
 * feed) must use this so a label change lands everywhere at once.
 *
 * Empty, `general`, and unrecognized values read "File" rather than guessing.
 */
export function documentTypeLabel(type: string | null | undefined): string {
  const raw = (type ?? "").trim();
  if (!raw || raw === "general") return "File";
  const known = DOCUMENT_TYPE_LABELS[raw];
  if (known) return known;
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS =
  /\.(pdf|txt|jpe?g|png|gif|webp|mp3|wav|m4a|aac|ogg|webm|mp4|docx?)$/i;

export function isAllowedUploadFile(file: { type: string; name: string }): boolean {
  const mime = normalizeUploadMimeType(file.name, file.type || "application/octet-stream");
  if (ALLOWED_EXTENSIONS.test(file.name)) return true;
  if (ALLOWED_UPLOAD_MIME_TYPES.has(mime)) return true;
  return false;
}

/** Strip charset suffixes; infer MIME from extension when the browser sends octet-stream. */
export function normalizeUploadMimeType(fileName: string, mimeType: string): string {
  const base = (mimeType || "application/octet-stream").toLowerCase().split(";")[0].trim();
  if (base && base !== "application/octet-stream") return base;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (/\.(jpe?g)$/i.test(lower)) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  return base || "application/octet-stream";
}

/** PDF files must start with %PDF- (blocks text/Shape exports saved with a .pdf extension). */
export const PDF_MAGIC = "%PDF-";

export function isPdfUpload(fileName: string, mimeType: string): boolean {
  const mime = (mimeType || "application/octet-stream").toLowerCase();
  return mime === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
}

export function hasPdfMagicBytes(data: ArrayBuffer | Uint8Array | Buffer): boolean {
  const bytes =
    data instanceof Buffer
      ? data
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export function getInvalidPdfUploadMessage(): string {
  return "Inline PDF preview is not available for this file. Download or open it in a new tab.";
}

/** Used by preview/audit only — uploads accept text-in-PDF exports from Shape. */
export function isMislabeledPdfContent(
  fileName: string,
  mimeType: string,
  bytes: ArrayBuffer | Uint8Array | Buffer
): boolean {
  if (!isPdfUpload(fileName, mimeType)) return false;
  return !hasPdfMagicBytes(bytes);
}

export function isLikelyTextContent(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 4096);
  if (!sample.length) return false;
  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) printable++;
  }
  return printable / sample.length >= 0.85;
}

/** Reads the first 5 bytes via HTTP Range (works on Supabase signed URLs). */
export async function readPdfMagicBytesFromSignedUrl(signedUrl: string): Promise<Uint8Array> {
  const res = await fetch(signedUrl, { headers: { Range: "bytes=0-4" } });
  if (!res.ok && res.status !== 206) {
    throw new Error(`Could not read uploaded file (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export function buildClientDocumentStoragePath(
  clientId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `clients/${clientId}/documents/${timestamp}_${safeName}`;
}

export function formatStorageUploadError(message: string): string {
  if (message.includes("already exists")) {
    return (
      "A file with this name already exists. Rename the file and try again."
    );
  }
  return `Upload failed: ${message}`;
}
