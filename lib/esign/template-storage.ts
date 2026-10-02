import { createAdminClient } from "@/lib/supabase/admin";
import { hasPdfMagicBytes } from "@/lib/clients/document-upload";
import { isUploadableEsignKind, type EsignKind } from "./types";

export const ESIGN_TEMPLATE_BUCKET = "esign-templates";
export const ESIGN_TEMPLATE_MAX_BYTES = 8 * 1024 * 1024;

export function storedTemplatePath(kind: EsignKind): string {
  return `${kind}.pdf`;
}

export function incomingTemplatePath(userId: string, kind: EsignKind): string {
  return `incoming/${userId}/${kind}.pdf`;
}

export function isIncomingTemplatePath(userId: string, kind: EsignKind, path: string): boolean {
  const clean = path.replace(/^\/+/, "");
  const expected = incomingTemplatePath(userId, kind);
  return clean === expected || clean.endsWith(`/${expected}`);
}

export async function readStoredEsignTemplate(kind: EsignKind): Promise<Buffer | null> {
  if (!isUploadableEsignKind(kind)) return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return null;
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(ESIGN_TEMPLATE_BUCKET)
      .download(storedTemplatePath(kind));
    if (error || !data) return null;
    const bytes = Buffer.from(await data.arrayBuffer());
    if (!hasPdfMagicBytes(bytes)) return null;
    return bytes;
  } catch (err) {
    console.error("[esign template] storage read", err instanceof Error ? err.message : err);
    return null;
  }
}
