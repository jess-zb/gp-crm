import { getPostlogicXApiKey, POSTLOGIC_INTAKE_URL } from "./constants";

export interface PostLogicPayloadRow {
  batchDate: string;
  partner: string;
  uniqueId: string;
  recipient: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  tracking: string;
}

export async function sendToPostLogic(
  rows: PostLogicPayloadRow[]
): Promise<{ success: boolean; error?: string }> {
  const url =
    process.env.POSTLOGIC_API_URL?.trim() ||
    process.env.POSTLOGIC_ENDPOINT?.trim() ||
    POSTLOGIC_INTAKE_URL;
  const apiKey = getPostlogicXApiKey();
  const bearer = process.env.POSTLOGIC_BEARER?.trim();

  if (!url || !bearer) {
    return {
      success: false,
      error: "PostLogic credentials not configured",
    };
  }

  const payload = rows.map((r) => [
    r.batchDate,
    r.partner,
    r.uniqueId,
    r.recipient,
    r.phone,
    r.address,
    r.city,
    r.state,
    r.zip,
    r.status,
    r.tracking,
  ]);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ payload }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${err}` };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Detect carrier from tracking number format (PostLogic / print partner). */
export function detectCarrier(tracking: string): string {
  if (!tracking) return "other";
  if (tracking.startsWith("1Z")) return "ups";
  if (/^920/.test(tracking)) return "usps";
  if (/^87[0-9]/.test(tracking)) return "fedex";
  return "fedex";
}

/** Today's batch date MM/DD/YYYY in Pacific time (PostLogic intake column). */
export function getBatchDate(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}
