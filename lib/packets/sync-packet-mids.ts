import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PacketNeededRow } from "@/app/admin/fedex-batches/packet-manager-types";
import { fetchPacketsNeeded } from "@/lib/packets/fetch-packet-manager-data";

type SheetMidRow = {
  clientName: string;
  merchant: string;
};

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

async function fetchMidsFromSheet(): Promise<{ map: Map<string, string>; error?: string }> {
  const endpoint = process.env.GOOGLE_SHEETS_PDF_ENDPOINT?.trim();
  if (!endpoint) {
    return { map: new Map(), error: "GOOGLE_SHEETS_PDF_ENDPOINT is not configured." };
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getMids" }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (e) {
    return { map: new Map(), error: e instanceof Error ? e.message : "Failed to reach Apps Script." };
  }

  const text = await res.text();
  let rows: SheetMidRow[];
  try {
    rows = JSON.parse(text) as SheetMidRow[];
  } catch {
    console.error("[sync-mids] Apps Script returned non-JSON (doGet not deployed?):", text.slice(0, 200));
    return {
      map: new Map(),
      error: "Apps Script is not returning data yet. Make sure you've added the doGet handler and redeployed the script.",
    };
  }

  if (!Array.isArray(rows)) {
    return { map: new Map(), error: "Unexpected response from Apps Script." };
  }

  const map = new Map<string, string>();
  for (const row of rows) {
    const name = normalizeName(row.clientName ?? "");
    const merchant = (row.merchant ?? "").trim();
    if (name && merchant) map.set(name, merchant);
  }
  return { map };
}

/** Sync clients.fedex_merchant from the MID Google Sheet for all Packets Needed clients. */
export async function syncPacketsNeededMids(
  admin: SupabaseClient,
  rows?: PacketNeededRow[]
): Promise<{ updated: number; total: number; error?: string }> {
  const needed = rows ?? (await fetchPacketsNeeded()).rows;

  const { map: sheetMap, error: sheetError } = await fetchMidsFromSheet();
  if (sheetError) {
    return { updated: 0, total: needed.length, error: sheetError };
  }
  if (sheetMap.size === 0) {
    return { updated: 0, total: needed.length };
  }

  let updated = 0;

  // MID lookup is per-client, not per-recipient — skip secondary rows so a
  // client with primary + secondary doesn't trigger two updates.
  const seenClientIds = new Set<string>();
  for (const row of needed) {
    if (row.recipient_type === "secondary") continue;
    if (seenClientIds.has(row.id)) continue;
    seenClientIds.add(row.id);

    const fullName = normalizeName(
      `${row.first_name ?? ""} ${row.last_name ?? ""}`
    );
    const merchant = sheetMap.get(fullName);
    if (!merchant) continue;

    const { error } = await admin
      .from("clients")
      .update({ fedex_merchant: merchant })
      .eq("id", row.id);
    if (!error) updated++;
  }

  return { updated, total: needed.length };
}
