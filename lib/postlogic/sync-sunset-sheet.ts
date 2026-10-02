import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const SHEET_RANGE = "Sheet1!A:C"; // Expected columns: first_name, last_name, merchant
const CHUNK_SIZE = 500;

export async function syncSunsetSheet(): Promise<{
  synced: number;
  error: string | null;
}> {
  const sheetId = process.env.GOOGLE_SHEETS_SUNSET_ID?.trim();
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim();

  if (!sheetId || !apiKey) {
    return {
      synced: 0,
      error: "GOOGLE_SHEETS_SUNSET_ID or GOOGLE_SHEETS_API_KEY not configured",
    };
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${SHEET_RANGE}?key=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    return {
      synced: 0,
      error: `Google Sheets API ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  const json = (await res.json()) as { values?: string[][] };
  const rows = json.values ?? [];

  // Row 0 is the header; skip it
  const dataRows = rows.slice(1);
  if (!dataRows.length) return { synced: 0, error: null };

  const now = new Date().toISOString();
  const upsertRows = dataRows
    .map((row) => {
      const firstName = row[0]?.trim() ?? "";
      const lastName = row[1]?.trim() ?? "";
      const merchant = row[2]?.trim() ?? "";
      if (!firstName || !lastName || !merchant) return null;
      return {
        name_key: `${firstName.toLowerCase()}|${lastName.toLowerCase()}`,
        first_name: firstName,
        last_name: lastName,
        merchant,
        synced_at: now,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (!upsertRows.length) return { synced: 0, error: null };

  const supabase = createAdminClient();
  let total = 0;

  for (let i = 0; i < upsertRows.length; i += CHUNK_SIZE) {
    const chunk = upsertRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from("sunset_lookup")
      .upsert(chunk, { onConflict: "name_key" });
    if (error) return { synced: total, error: error.message };
    total += chunk.length;
  }

  return { synced: total, error: null };
}
