import { createAdminClient } from "@/lib/supabase/admin";
import { hasPdfMagicBytes } from "@/lib/clients/document-upload";

export const ESIGN_TEMPLATE_BUCKET = "esign-templates";
export const ESIGN_TEMPLATE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Templates are keyed by MID slug so the bucket stays browsable, and by
 * template id so a rename never orphans the PDF. This is why mids.slug is
 * stored rather than derived from the current name.
 */
export function templateStoragePath(midSlug: string, templateId: string): string {
  return `${midSlug}/${templateId}.pdf`;
}

export function incomingTemplatePath(userId: string, token: string): string {
  return `incoming/${userId}/${token}.pdf`;
}

export function isIncomingTemplatePath(
  userId: string,
  token: string,
  path: string
): boolean {
  const clean = path.replace(/^\/+/, "");
  const expected = incomingTemplatePath(userId, token);
  return clean === expected || clean.endsWith(`/${expected}`);
}

/** The template PDF. Storage is the only source — nothing is bundled. */
export async function readEsignTemplateFile(storagePath: string): Promise<Buffer> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(ESIGN_TEMPLATE_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`E-Sign template not found in storage: ${storagePath}`);
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (!hasPdfMagicBytes(bytes)) {
    throw new Error(`E-Sign template is not a PDF: ${storagePath}`);
  }
  return bytes;
}

/** Move an uploaded PDF from the staging prefix to its template path. */
export async function promoteIncomingTemplate(
  incoming: string,
  finalPath: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error: removeErr } = await admin.storage
    .from(ESIGN_TEMPLATE_BUCKET)
    .remove([finalPath]);
  if (removeErr && !/not found/i.test(removeErr.message)) {
    return { ok: false, error: removeErr.message };
  }
  const { error } = await admin.storage
    .from(ESIGN_TEMPLATE_BUCKET)
    .move(incoming, finalPath);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteTemplateFile(storagePath: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(ESIGN_TEMPLATE_BUCKET)
    .remove([storagePath]);
  if (error && !/not found/i.test(error.message)) {
    console.error("[esign template] delete:", error.message);
  }
}
