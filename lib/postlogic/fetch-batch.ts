import "server-only";

import {
  getPostlogicXApiKey,
  POSTLOGIC_INTAKE_URL,
  POSTLOGIC_PARTNER,
} from "@/lib/postlogic/constants";

export type PostlogicBatchShipment = {
  recipient?: string | null;
  phone?: string | null;
  unique_id?: string | null;
  tracking?: string | null;
  status?: string | null;
};

export type PostlogicBatchResponse = {
  status?: string;
  shipments?: PostlogicBatchShipment[];
};

function postlogicBaseUrl(): string {
  return (
    process.env.POSTLOGIC_API_URL?.trim() ||
    process.env.POSTLOGIC_ENDPOINT?.trim() ||
    POSTLOGIC_INTAKE_URL
  );
}

function postlogicBearer(): string {
  const raw = process.env.POSTLOGIC_BEARER?.trim() ?? "";
  if (!raw) return "";
  return raw.toLowerCase().startsWith("bearer ") ? raw : `Bearer ${raw}`;
}

export type PostlogicSingleShipment = {
  tracking?: string | null;
  status?: string | null;
};

/** GET /intake?unique_id=…&key=… — searches archives (unlike batch-only list). */
export async function fetchPostlogicShipmentByUniqueId(
  uniqueId: string
): Promise<{
  ok: boolean;
  status: number;
  shipment: PostlogicSingleShipment | null;
}> {
  const apiKey = getPostlogicXApiKey();
  const url = new URL(postlogicBaseUrl());
  url.searchParams.set("unique_id", uniqueId.trim());
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      "x-api-key": apiKey,
      Authorization: postlogicBearer(),
    },
  });

  if (!res.ok) {
    return { ok: false, status: res.status, shipment: null };
  }

  let parsed: { shipment?: PostlogicSingleShipment; status?: string } = {};
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    return { ok: false, status: res.status, shipment: null };
  }

  if (parsed.shipment && typeof parsed.shipment === "object") {
    return { ok: true, status: res.status, shipment: parsed.shipment };
  }

  return { ok: true, status: res.status, shipment: null };
}

/** GET /intake?action=batch&partner=…&batch_date=…&key=… */
export async function fetchPostlogicBatch(batchDate: string): Promise<{
  ok: boolean;
  status: number;
  shipments: PostlogicBatchShipment[];
  raw: string;
}> {
  const apiKey = getPostlogicXApiKey();
  const url = new URL(postlogicBaseUrl());
  url.searchParams.set("action", "batch");
  url.searchParams.set("partner", POSTLOGIC_PARTNER);
  url.searchParams.set("batch_date", batchDate);
  url.searchParams.set("include_archived", "true");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      Authorization: postlogicBearer(),
    },
  });

  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, shipments: [], raw };
  }

  let parsed: PostlogicBatchResponse = {};
  try {
    parsed = JSON.parse(raw) as PostlogicBatchResponse;
  } catch {
    return { ok: false, status: res.status, shipments: [], raw };
  }

  if (parsed.status && parsed.status !== "success") {
    return { ok: false, status: res.status, shipments: [], raw };
  }

  return {
    ok: true,
    status: res.status,
    shipments: parsed.shipments ?? [],
    raw,
  };
}
