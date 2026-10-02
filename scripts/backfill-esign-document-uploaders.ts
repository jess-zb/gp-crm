/**
 * Set documents.uploaded_by from the staff who sent the eSign request.
 *
 *   npx tsx scripts/backfill-esign-document-uploaders.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.development.local" });
config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await admin
    .from("esign_requests")
    .select("id, sent_by, signed_document_id")
    .not("signed_document_id", "is", null)
    .not("sent_by", "is", null);

  if (error) throw new Error(error.message);

  let updated = 0;
  for (const row of rows ?? []) {
    const docId = row.signed_document_id as string;
    const sentBy = row.sent_by as string;
    const { data, error: upErr } = await admin
      .from("documents")
      .update({ uploaded_by: sentBy })
      .eq("id", docId)
      .is("uploaded_by", null)
      .select("id");
    if (upErr) {
      console.error("update failed", docId, upErr.message);
      continue;
    }
    if (data?.length) updated += data.length;
  }

  console.log(`Backfilled uploaded_by on ${updated} signed eSign document(s).`);
}

void main();
