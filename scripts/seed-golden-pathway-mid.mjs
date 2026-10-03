/**
 * Seed the only built-in MID: Golden Pathway, plus its two e-sign PDFs.
 * PostLogic and every other MID are added in Settings, not here.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/seed-golden-pathway-mid.mjs
 *
 * PDFs default to the copies staged in lib/esign/templates (the Golden Pathway
 * forms). Override with GP_ESIGN_DIR.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const dir = process.env.GP_ESIGN_DIR?.trim() || path.join(process.cwd(), "lib/esign/templates");
const docs = [
  {
    name: "Credit card authorization",
    hint: "Bank authorization form",
    behavior: "cc_authorization",
    documentType: "cc_authorization",
    file: "cc-auth.pdf",
    required: ["fullName", "advisor", "mid", "card1Last4", "card1Amount"],
  },
  {
    name: "Welcome Packet",
    hint: "Signed POA — advances the client once signed",
    behavior: "welcome_packet",
    documentType: "poa_signed",
    file: "welcome-packet.pdf",
    required: ["mid"],
  },
];

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing, error: lookupErr } = await supabase
  .from("mids")
  .select("id, slug")
  .eq("slug", "golden-pathway")
  .maybeSingle();
if (lookupErr) {
  console.error(lookupErr.message);
  process.exit(1);
}

let midId = existing?.id;
if (!midId) {
  const { data, error } = await supabase
    .from("mids")
    .insert({ name: "Golden Pathway", slug: "golden-pathway", sort_order: 10 })
    .select("id")
    .single();
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  midId = data.id;
  console.log("Created MID Golden Pathway", midId);
} else {
  console.log("MID Golden Pathway already exists", midId);
}

for (const [index, doc] of docs.entries()) {
  const { data: already } = await supabase
    .from("esign_templates")
    .select("id")
    .eq("mid_id", midId)
    .eq("name", doc.name)
    .maybeSingle();
  if (already?.id) {
    console.log("Already present:", doc.name);
    continue;
  }

  const templateId = crypto.randomUUID();
  const storagePath = `golden-pathway/${templateId}.pdf`;
  const bytes = await readFile(path.join(dir, doc.file));
  const { error: upErr } = await supabase.storage
    .from("esign-templates")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr) {
    console.error(doc.name, upErr.message);
    process.exit(1);
  }

  const { error } = await supabase.from("esign_templates").insert({
    id: templateId,
    mid_id: midId,
    name: doc.name,
    hint: doc.hint,
    behavior: doc.behavior,
    document_type: doc.documentType,
    storage_path: storagePath,
    fields: [],
    required_binds: doc.required,
    sort_order: (index + 1) * 10,
  });
  if (error) {
    console.error(doc.name, error.message);
    process.exit(1);
  }
  console.log("Seeded", doc.name, storagePath);
}

console.log("Golden Pathway seed done.");
