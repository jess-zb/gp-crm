import type { EsignKind } from "./types";

/** Overlay in PDF points; yTop is distance from the top of the page to the underline. */
export type TextStamp = {
  key: string;
  page: number;
  x: number;
  yTop: number;
  size?: number;
};

export type SignatureStamp = {
  page: number;
  x: number;
  yTop: number;
  width: number;
  height: number;
};

export type EsignFieldMap = {
  texts: TextStamp[];
  signatures: SignatureStamp[];
};

const CC_AUTH: EsignFieldMap = {
  texts: [
    { key: "amountAuthorized", page: 0, x: 185, yTop: 292.5 },
    { key: "card1Last4", page: 0, x: 155, yTop: 321 },
    { key: "card1Amount", page: 0, x: 288, yTop: 341.5 },
    { key: "card2Last4", page: 0, x: 155, yTop: 350.4 },
    { key: "card2Amount", page: 0, x: 288, yTop: 371 },
    { key: "mid", page: 0, x: 62, yTop: 514, size: 10 },
    { key: "printedName", page: 0, x: 148, yTop: 688.5 },
    { key: "signedDate", page: 0, x: 100, yTop: 724 },
  ],
  signatures: [{ page: 0, x: 185, yTop: 653, width: 340, height: 36 }],
};

const WELCOME_PACKET: EsignFieldMap = {
  texts: [
    { key: "fullName", page: 0, x: 110, yTop: 179 },
    { key: "advisor", page: 0, x: 130, yTop: 256.5 },
    { key: "mid", page: 0, x: 205, yTop: 426.5 },
    { key: "fullName", page: 1, x: 300, yTop: 227.5 },
    { key: "fullName", page: 1, x: 210, yTop: 551 },
    { key: "signedDate", page: 1, x: 180, yTop: 582 },
    { key: "fullName", page: 2, x: 350, yTop: 273.5 },
    { key: "fullName", page: 2, x: 160, yTop: 563.5 },
    { key: "signedDate", page: 2, x: 180, yTop: 594.5 },
    { key: "fullName", page: 3, x: 80, yTop: 221.5 },
    { key: "fullName", page: 3, x: 170, yTop: 613 },
    { key: "signedDate", page: 3, x: 110, yTop: 644 },
    { key: "fullName", page: 4, x: 160, yTop: 539 },
    { key: "signedDate", page: 4, x: 100, yTop: 570.5 },
  ],
  signatures: [
    { page: 1, x: 180, yTop: 566.5, width: 250, height: 22 },
    { page: 2, x: 175, yTop: 579, width: 250, height: 22 },
    { page: 3, x: 145, yTop: 628.5, width: 280, height: 22 },
    { page: 4, x: 140, yTop: 555, width: 280, height: 22 },
  ],
};

const EMPTY: EsignFieldMap = { texts: [], signatures: [] };

export function fieldMapForKind(kind: EsignKind): EsignFieldMap {
  if (kind === "welcome_packet") return WELCOME_PACKET;
  if (kind === "cc_authorization") return CC_AUTH;
  return EMPTY;
}
