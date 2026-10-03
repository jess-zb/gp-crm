import { defaultSizeForBind, type EsignBindKey, type EsignLayoutField } from "./layout";

/** A text run on a PDF page, in the same percent space the field editor uses. */
export type PdfTextItem = {
  page: number;
  text: string;
  /** Left edge, 0–100 from the left. */
  xPct: number;
  /** Top edge, 0–100 from the top. */
  yPct: number;
  wPct: number;
  hPct: number;
};

/**
 * Labels the uploader can place on its own. Cards, amounts, and anything that
 * does not match stay off the page so staff can drag those on in the editor.
 * Longer labels come first so "Date of Birth" does not also match "Date".
 */
const LABEL_RULES: { bind: EsignBindKey; re: RegExp }[] = [
  { bind: "dateOfBirth", re: /^(date of birth|birth date|birthdate|dob)$/i },
  { bind: "signedDate", re: /^(date|date signed|signing date|today'?s date)$/i },
  {
    bind: "signature",
    re: /^(cardholder signature|client signature|authorized signature|signature of client|borrower signature|signature|sign here)$/i,
  },
  { bind: "spouseName", re: /^(spouse|spouse'?s name|spouse name|co-?applicant name)$/i },
  { bind: "firstName", re: /^(first name|given name)$/i },
  { bind: "lastName", re: /^(last name|surname|family name)$/i },
  {
    bind: "fullName",
    re: /^(client full name|full legal name|cardholder name|name on card|full name|client name|signer name|print name|printed name|legal name|name of client|customer name|name)$/i,
  },
  { bind: "email", re: /^(client email|e-?mail( address)?)$/i },
  { bind: "phone", re: /^(phone|phone number|telephone|mobile|cell( phone)?|tel)$/i },
  {
    bind: "amountAuthorized",
    re: /^(authorized charge amount|authorized amount|amount authorized|charge amount|agreed service fee|service fee)$/i,
  },
  { bind: "cityStateZip", re: /^(city\s*[,/]\s*state\s*[,/]\s*(zip|postal)( code)?)$/i },
  { bind: "street", re: /^(billing street address|street( address)?)$/i },
  {
    bind: "address",
    re: /^(billing address|address|mailing address|home address|client address|residential address)$/i,
  },
  { bind: "city", re: /^city$/i },
  { bind: "state", re: /^state$/i },
  { bind: "zip", re: /^(zip|zip code|postal code)$/i },
  { bind: "advisor", re: /^(account manager|advisor)$/i },
  { bind: "mid", re: /^(mid|merchant( id)?)$/i },
];

const MAX_FIELDS = 30;

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function matchLabel(raw: string): EsignBindKey | null {
  const stripped = raw
    .replace(/_+/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[:.#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped || stripped.length > 48) return null;
  for (const rule of LABEL_RULES) {
    if (rule.re.test(stripped)) return rule.bind;
  }
  return null;
}

function clusterLines(items: PdfTextItem[]): PdfTextItem[][] {
  const sorted = items
    .filter((item) => item.text.trim() && item.hPct > 0.05)
    .sort((a, b) => a.page - b.page || a.yPct - b.yPct || a.xPct - b.xPct);
  const lines: PdfTextItem[][] = [];
  for (const item of sorted) {
    const line = lines.find(
      (row) => row[0].page === item.page && Math.abs(row[0].yPct - item.yPct) < 0.9
    );
    if (line) line.push({ ...item, text: item.text.trim() });
    else lines.push([{ ...item, text: item.text.trim() }]);
  }
  for (const line of lines) line.sort((a, b) => a.xPct - b.xPct);
  return lines;
}

/** Join words that sit next to each other. A wide gap is a blank, not a word space. */
function mergeRuns(line: PdfTextItem[]): PdfTextItem[] {
  const runs: PdfTextItem[] = [];
  for (const item of line) {
    const prev = runs[runs.length - 1];
    const gap = prev ? item.xPct - (prev.xPct + prev.wPct) : 99;
    if (prev && gap >= -0.4 && gap < 1.6 && (prev.text + item.text).length < 60) {
      const text = (gap > 0.15 ? `${prev.text} ${item.text}` : `${prev.text}${item.text}`)
        .replace(/\s+/g, " ")
        .trim();
      const right = Math.max(prev.xPct + prev.wPct, item.xPct + item.wPct);
      prev.text = text;
      prev.wPct = right - prev.xPct;
      prev.hPct = Math.max(prev.hPct, item.hPct);
      prev.yPct = Math.min(prev.yPct, item.yPct);
    } else {
      runs.push({ ...item });
    }
  }
  return runs;
}

function placeBox(run: PdfTextItem, line: PdfTextItem[], bind: EsignBindKey): EsignLayoutField {
  const size = defaultSizeForBind(bind);
  const underscores = /_+/.test(run.text);
  const inline = underscores || run.text.includes(":");
  let x = run.xPct;
  let y = run.yPct;
  let w = size.wPct;
  const h = size.hPct;
  const next = line.find((other) => other.xPct > run.xPct + 0.8);

  if (underscores) {
    const before = run.text.split(/_+/)[0] ?? "";
    const ratio = before.length / Math.max(1, run.text.length);
    const labelW = run.wPct * ratio;
    x = run.xPct + labelW;
    w = Math.max(8, run.wPct - labelW);
    y = run.yPct - 0.15;
  } else if (inline) {
    x = run.xPct + run.wPct + 0.5;
    y = run.yPct - 0.15;
    if (next) {
      const room = next.xPct - x - 0.4;
      const minRoom = bind === "state" || bind === "zip" ? 6 : 8;
      if (room >= minRoom) w = Math.min(size.wPct, room);
      else {
        x = run.xPct;
        y = run.yPct + Math.max(run.hPct, 1.2) + 0.45;
        w = Math.min(size.wPct, Math.max(8, (next.xPct - run.xPct) - 1.2));
      }
    }
  } else {
    // Headings such as "CLIENT FULL NAME" sit above the blank, not beside it.
    x = run.xPct;
    y = run.yPct + Math.max(run.hPct, 1.2) + 0.45;
    const column = next ? next.xPct - run.xPct - 1.2 : size.wPct;
    w = Math.min(size.wPct, Math.max(8, column));
  }

  x = clamp(x, 0.4, 90);
  y = clamp(y, 0.4, 96);
  w = clamp(w, 8, 98 - x);
  return {
    id: crypto.randomUUID(),
    bind,
    page: run.page,
    xPct: roundPct(x),
    yPct: roundPct(y),
    wPct: roundPct(w),
    hPct: roundPct(h),
  };
}

function overlaps(a: EsignLayoutField, b: EsignLayoutField): boolean {
  if (a.page !== b.page) return false;
  const iw = Math.min(a.xPct + a.wPct, b.xPct + b.wPct) - Math.max(a.xPct, b.xPct);
  const ih = Math.min(a.yPct + a.hPct, b.yPct + b.hPct) - Math.max(a.yPct, b.yPct);
  return iw > 0.8 && ih > 0.4;
}

function sameSpot(a: EsignLayoutField, b: EsignLayoutField): boolean {
  if (a.page !== b.page || a.bind !== b.bind) return false;
  const ax = a.xPct + a.wPct / 2;
  const ay = a.yPct + a.hPct / 2;
  const bx = b.xPct + b.wPct / 2;
  const by = b.yPct + b.hPct / 2;
  return Math.abs(ax - bx) < 6 && Math.abs(ay - by) < 2;
}

/**
 * Turn PDF text into starting field boxes. A label counts when the whole run
 * is a caption ("Name:", "CLIENT FULL NAME", "ZIP CODE"). A colon or
 * underscores puts the box on that line; a heading puts it in the blank
 * underneath. Sentences that merely contain the word "name" are left alone.
 */
export function suggestLayoutFields(items: PdfTextItem[]): EsignLayoutField[] {
  const found: EsignLayoutField[] = [];
  for (const line of clusterLines(items)) {
    const runs = mergeRuns(line);
    for (const run of runs) {
      const bind = matchLabel(run.text);
      if (!bind) continue;
      const box = placeBox(run, runs, bind);
      if (found.some((row) => overlaps(row, box) || sameSpot(row, box))) continue;
      found.push(box);
      if (found.length >= MAX_FIELDS) break;
    }
    if (found.length >= MAX_FIELDS) break;
  }

  const splitAddress = found.some((field) =>
    field.bind === "city" || field.bind === "state" || field.bind === "zip" || field.bind === "cityStateZip"
  );
  if (!splitAddress) return found;
  return found.map((field) => (field.bind === "address" ? { ...field, bind: "street" } : field));
}

/** Add suggestions that do not sit on a box already on the page. */
export function mergeSuggestedFields(
  existing: EsignLayoutField[],
  suggested: EsignLayoutField[]
): EsignLayoutField[] {
  const next = [...existing];
  for (const field of suggested) {
    if (next.some((row) => overlaps(row, field) || sameSpot(row, field))) continue;
    next.push(field);
  }
  return next;
}
