import "server-only";
import type { EsignLayoutField } from "./layout";
import { extractPdfTextItems } from "./pdf-text";
import { suggestLayoutFields } from "./suggest-fields";

/**
 * Starting placement for a newly uploaded template. A PDF with no text layer,
 * or a reader failure, yields an empty list so the upload still succeeds and
 * staff place every box by hand.
 */
export async function suggestFieldsFromPdf(bytes: Uint8Array): Promise<EsignLayoutField[]> {
  try {
    const items = await extractPdfTextItems(bytes);
    return suggestLayoutFields(items);
  } catch (err) {
    console.error("[esign suggest]", err instanceof Error ? err.message : err);
    return [];
  }
}
