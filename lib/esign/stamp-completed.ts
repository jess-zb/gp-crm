import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

const NAVY = rgb(10 / 255, 37 / 255, 64 / 255);
const MINT = rgb(141 / 255, 227 / 255, 181 / 255);
const HEADER_H = 44;
const FOOTER_H = 22;

export function drawNavyTopBanner(
  page: PDFPage,
  logo: PDFImage | null,
  font: PDFFont,
  rightLabel: string
) {
  const { width, height } = page.getSize();
  page.drawRectangle({
    x: 0,
    y: height - HEADER_H,
    width,
    height: HEADER_H,
    color: NAVY,
  });
  if (logo) {
    const maxH = 28;
    const scale = Math.min(maxH / logo.height, 168 / logo.width);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, {
      x: 14,
      y: height - HEADER_H + (HEADER_H - h) / 2,
      width: w,
      height: h,
    });
  }
  const size = 9;
  const label = rightLabel.trim();
  if (label) {
    const tw = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: Math.max(14, width - tw - 16),
      y: height - HEADER_H + (HEADER_H - size) / 2 - 1,
      size,
      font,
      color: MINT,
    });
  }
}

/** Footer on every form page: electronic original + do-not-alter. */
export async function stampSignedFormPages(
  pdf: Uint8Array,
  certRef: string | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const ref = (certRef ?? "—").trim() || "—";
  const line = `ELECTRONIC ORIGINAL · Do not alter · DebtSupportPros CRM · Cert ${ref} · Altering this file voids the signature record`;

  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: FOOTER_H,
      color: NAVY,
    });
    const size = 6.5;
    let text = line;
    while (font.widthOfTextAtSize(text, size) > width - 16 && text.length > 20) {
      text = `${text.slice(0, -2)}…`;
    }
    page.drawText(text, {
      x: 8,
      y: 8,
      size,
      font,
      color: MINT,
    });
  }
  return doc.save({ useObjectStreams: false });
}

/** Attach the certificate of completion as extra pages on the signed form. */
export async function appendCertificatePages(
  formPdf: Uint8Array,
  certificatePdf: Uint8Array
): Promise<Uint8Array> {
  const form = await PDFDocument.load(formPdf, { ignoreEncryption: true });
  const cert = await PDFDocument.load(certificatePdf, { ignoreEncryption: true });
  const copied = await form.copyPages(cert, cert.getPageIndices());
  for (const page of copied) form.addPage(page);
  return form.save({ useObjectStreams: false });
}
