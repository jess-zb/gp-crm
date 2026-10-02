import {
  hasPdfMagicBytes,
  isLikelyTextContent,
  isPdfUpload,
  normalizeUploadMimeType,
} from "./document-upload";

/** How stored bytes behave — metadata alone cannot detect text saved as .pdf. */
export type DocumentContentKind =
  | "pdf"
  | "text_as_pdf"
  | "text"
  | "image"
  | "audio"
  | "video"
  | "word"
  | "binary"
  | "unknown";

export function classifyDocumentByMetadata(
  fileName: string,
  mimeType: string | null | undefined
): DocumentContentKind {
  const mime = normalizeUploadMimeType(fileName, mimeType ?? "");
  const lower = fileName.toLowerCase();
  if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|svg)$/i.test(lower)) {
    return "image";
  }
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(lower)) {
    return "audio";
  }
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/i.test(lower)) {
    return "video";
  }
  if (mime.includes("word") || /\.docx?$/i.test(lower)) return "word";
  if (mime.startsWith("text/") || lower.endsWith(".txt")) return "text";
  if (isPdfUpload(fileName, mime)) return "pdf";
  return "unknown";
}

/** Sniff bytes when metadata says PDF — distinguishes real PDF vs Shape text export. */
export async function sniffDocumentContentKind(
  fileName: string,
  mimeType: string | null | undefined,
  fileUrl: string
): Promise<DocumentContentKind> {
  const byMeta = classifyDocumentByMetadata(fileName, mimeType);
  if (byMeta !== "pdf") return byMeta;

  try {
    const headerRes = await fetch(fileUrl, { headers: { Range: "bytes=0-511" } });
    if (!headerRes.ok && headerRes.status !== 206) return "pdf";
    const header = new Uint8Array(await headerRes.arrayBuffer());
    if (hasPdfMagicBytes(header)) return "pdf";

    const fullRes = await fetch(fileUrl);
    if (!fullRes.ok) return "text_as_pdf";
    const body = await fullRes.text();
    return isLikelyTextContent(body) ? "text_as_pdf" : "binary";
  } catch {
    return "pdf";
  }
}

export function sanitizeDownloadFileName(fileName: string): string {
  const trimmed = fileName.trim() || "download";
  return trimmed.replace(/[^\w.\-()+ ]+/g, "_");
}

/**
 * Filename saved to disk — Shape text exports keep the original name and append `.txt`
 * (e.g. `WALTER WEAVER.pdf` → `WALTER WEAVER.pdf.txt`) so double-click opens in a text editor.
 */
export function resolveDownloadFileName(
  fileName: string,
  contentKind: DocumentContentKind
): string {
  const safe = sanitizeDownloadFileName(fileName);
  if (contentKind === "text_as_pdf") {
    return safe.toLowerCase().endsWith(".txt") ? safe : `${safe}.txt`;
  }
  return safe;
}

/** Classify stored bytes for download naming (server-side, no signed URL fetch). */
export function resolveDownloadContentKind(
  fileName: string,
  mimeType: string | null | undefined,
  bytes: ArrayBuffer | Uint8Array
): DocumentContentKind {
  const meta = classifyDocumentByMetadata(fileName, mimeType);
  if (meta !== "pdf") return meta;

  const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  if (hasPdfMagicBytes(data)) return "pdf";

  try {
    const text = new TextDecoder().decode(data);
    return isLikelyTextContent(text) ? "text_as_pdf" : "binary";
  } catch {
    return "pdf";
  }
}

export function resolveDownloadContentType(
  contentKind: DocumentContentKind,
  fallbackMime: string
): string {
  if (contentKind === "text_as_pdf" || contentKind === "text") return "text/plain";
  return fallbackMime;
}

/** Same-origin CRM download route — streams raw bytes with Content-Disposition: attachment. */
export function getClientDocumentDownloadUrl(documentId: string): string {
  return `/api/clients/documents/download?documentId=${encodeURIComponent(documentId)}&t=${Date.now()}`;
}

/** Same-origin preview stream — inline disposition for DocPreviewModal / PDF iframe. */
export function getClientDocumentPreviewUrl(documentId: string): string {
  return `${getClientDocumentDownloadUrl(documentId)}&inline=1`;
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Fetch signed URL bytes and save with a filename that matches the actual content. */
export async function downloadDocumentFromUrl(
  fileUrl: string,
  fileName: string,
  contentKind?: DocumentContentKind
): Promise<void> {
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  const kind =
    contentKind ??
    resolveDownloadContentKind(
      fileName,
      res.headers.get("content-type"),
      buffer
    );
  const downloadName = resolveDownloadFileName(fileName, kind);
  const type = resolveDownloadContentType(
    kind,
    res.headers.get("content-type") ?? "application/octet-stream"
  );
  triggerBlobDownload(new Blob([buffer], { type }), downloadName);
}

/** Same-origin CRM download — triggers save without leaving the page. */
export function triggerApiDocumentDownload(documentId: string): void {
  const a = document.createElement("a");
  a.href = getClientDocumentDownloadUrl(documentId);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Reliable download — prefers same-origin API when documentId is known;
 * otherwise blob-fetches the signed URL so fake PDFs still save correctly.
 */
export async function downloadClientDocument(options: {
  fileName: string;
  documentId?: string;
  fileUrl?: string;
  contentKind?: DocumentContentKind;
}): Promise<void> {
  const { fileName, documentId, fileUrl, contentKind } = options;
  if (documentId) {
    triggerApiDocumentDownload(documentId);
    return;
  }
  if (fileUrl) {
    await downloadDocumentFromUrl(fileUrl, fileName, contentKind);
    return;
  }
  throw new Error("Missing documentId or fileUrl");
}

/** Open in a new tab — text exports use text/plain so the browser can display them. */
export async function openClientDocument(options: {
  fileName: string;
  fileUrl: string;
  contentKind: DocumentContentKind;
  textContent?: string | null;
}): Promise<void> {
  const { fileName, fileUrl, contentKind, textContent } = options;
  if (contentKind === "text_as_pdf" || contentKind === "text") {
    const body =
      textContent ??
      (await (await fetch(fileUrl)).text());
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      triggerBlobDownload(blob, resolveDownloadFileName(fileName, contentKind));
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  window.open(fileUrl, "_blank", "noopener,noreferrer");
}
