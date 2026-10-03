import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { valueForBind, type EsignLayoutField } from "./layout";
import type { EsignClientPrefill } from "./map-client-prefill";
import { formatAdvisorNameForEsign, toTitleCaseName } from "./review-fields";

function toWinAnsi(text: string): string {
  return text.replace(/[^\t\n\r\x20-\x7E]/g, (ch) => {
    const map: Record<string, string> = {
      "\u2018": "'",
      "\u2019": "'",
      "\u201C": '"',
      "\u201D": '"',
      "\u2013": "-",
      "\u2014": "-",
      "\u2026": "...",
    };
    return map[ch] ?? "";
  });
}

function yFromTop(page: PDFPage, yTop: number): number {
  return page.getSize().height - yTop;
}

function drawFitted(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  yTop: number,
  size: number,
  maxWidth: number
) {
  const clean = toWinAnsi(text).trim();
  if (!clean) return;
  let s = size;
  while (s > 7 && font.widthOfTextAtSize(clean, s) > maxWidth) s -= 0.5;
  page.drawText(clean, {
    x,
    y: yFromTop(page, yTop) + 2,
    size: s,
    font,
    color: rgb(0.07, 0.09, 0.14),
  });
}

export async function flattenSignedPdf(args: {
  /** Storage path of the blank template PDF. */
  storagePath?: string;
  /** In-memory PDF for tests. Used instead of storage when present. */
  sourcePdf?: Uint8Array;
  prefill: EsignClientPrefill;
  signedDate: string;
  fields: EsignLayoutField[];
  /** When omitted, signature boxes are left blank (client preview). */
  signaturePng?: Uint8Array | null;
  /** If set, only these signature field ids receive the PNG. */
  signatureFieldIds?: string[] | null;
}): Promise<Uint8Array> {
  const bytes = args.sourcePdf
    ? Buffer.from(args.sourcePdf)
    : await (await import("./template-storage")).readEsignTemplateFile(args.storagePath ?? "");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sig = args.signaturePng?.length
    ? await doc.embedPng(args.signaturePng)
    : null;
  const layout = args.fields;

  for (const field of layout) {
    if (field.page < 0 || field.page >= doc.getPageCount()) continue;
    const page = doc.getPage(field.page);
    const { width, height } = page.getSize();
    const x = (field.xPct / 100) * width;
    const yTop = (field.yPct / 100) * height;
    const w = (field.wPct / 100) * width;
    const h = (field.hPct / 100) * height;
    if (field.bind === "signature") {
      if (sig) {
        const allowed = args.signatureFieldIds;
        if (allowed && !allowed.includes(field.id)) continue;
        const scale = Math.min(w / Math.max(1, sig.width), h / Math.max(1, sig.height));
        const drawW = sig.width * scale;
        const drawH = sig.height * scale;
        page.drawImage(sig, {
          x,
          y: yFromTop(page, yTop + h),
          width: drawW,
          height: drawH,
        });
      }
      continue;
    }
    const raw = valueForBind(field.bind, args.prefill, args.signedDate);
    const stamped =
      field.bind === "advisor"
        ? formatAdvisorNameForEsign(raw)
        : field.bind === "fullName"
          ? toTitleCaseName(raw)
          : raw;
    drawFitted(
      page,
      font,
      stamped,
      x,
      yTop + h,
      11,
      Math.max(40, w)
    );
  }
  return doc.save({ useObjectStreams: false });
}
