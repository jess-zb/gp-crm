/**
 * Lists client documents labeled as PDF that lack %PDF- magic bytes in Storage.
 *
 *   npm run audit:mislabeled-pdfs
 *   npm run audit:mislabeled-pdfs -- --limit 100
 *   npm run audit:mislabeled-pdfs -- --json
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  hasPdfMagicBytes,
  isLikelyTextContent,
  isPdfUpload,
  readPdfMagicBytesFromSignedUrl,
} from "../lib/clients/document-upload";

config({ path: ".env.local" });

const BUCKET = "client-documents";

type DocRow = {
  id: string;
  client_id: string;
  file_name: string;
  mime_type: string | null;
  storage_path: string;
  created_at: string | null;
  file_size_bytes: number | null;
};

type AuditRow = {
  id: string;
  client_id: string;
  file_name: string;
  storage_path: string;
  created_at: string | null;
  file_size_bytes: number | null;
  content_kind: "text" | "binary" | "empty" | "missing";
  preview: string;
  error?: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = Number(args[++i]);
    } else if (args[i] === "--json") {
      json = true;
    }
  }
  return { limit, json };
}

async function classifyMislabeled(
  signedUrl: string
): Promise<Pick<AuditRow, "content_kind" | "preview">> {
  const res = await fetch(signedUrl, { headers: { Range: "bytes=0-511" } });
  if (!res.ok && res.status !== 206) {
    return { content_kind: "missing", preview: "" };
  }
  const header = new Uint8Array(await res.arrayBuffer());
  if (header.length === 0) {
    return { content_kind: "empty", preview: "" };
  }
  const fullRes = await fetch(signedUrl);
  const body = await fullRes.text();
  const preview = body.replace(/\s+/g, " ").trim().slice(0, 120);
  if (isLikelyTextContent(body)) {
    return { content_kind: "text", preview };
  }
  return { content_kind: "binary", preview: preview || "(non-text)" };
}

async function main() {
  const { limit, json } = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("documents")
    .select("id, client_id, file_name, mime_type, storage_path, created_at, file_size_bytes")
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data: rows, error } = await query;
  if (error) {
    console.error("documents query failed:", error.message);
    process.exit(1);
  }

  const pdfRows = (rows ?? []).filter((row) =>
    isPdfUpload(row.file_name, row.mime_type ?? "")
  ) as DocRow[];

  console.error(`Scanning ${pdfRows.length} PDF-labeled document(s)…\n`);

  const mislabeled: AuditRow[] = [];
  let checked = 0;
  let valid = 0;
  let skipped = 0;

  for (const row of pdfRows) {
    checked++;
    if (!row.storage_path) {
      skipped++;
      continue;
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 120);

    if (signErr || !signed?.signedUrl) {
      mislabeled.push({
        id: row.id,
        client_id: row.client_id,
        file_name: row.file_name,
        storage_path: row.storage_path,
        created_at: row.created_at,
        file_size_bytes: row.file_size_bytes,
        content_kind: "missing",
        preview: "",
        error: signErr?.message ?? "signed URL failed",
      });
      continue;
    }

    try {
      const magic = await readPdfMagicBytesFromSignedUrl(signed.signedUrl);
      if (hasPdfMagicBytes(magic)) {
        valid++;
        continue;
      }

      const classified = await classifyMislabeled(signed.signedUrl);
      mislabeled.push({
        id: row.id,
        client_id: row.client_id,
        file_name: row.file_name,
        storage_path: row.storage_path,
        created_at: row.created_at,
        file_size_bytes: row.file_size_bytes,
        ...classified,
      });
    } catch (err) {
      mislabeled.push({
        id: row.id,
        client_id: row.client_id,
        file_name: row.file_name,
        storage_path: row.storage_path,
        created_at: row.created_at,
        file_size_bytes: row.file_size_bytes,
        content_kind: "missing",
        preview: "",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          scanned: checked,
          valid_pdfs: valid,
          mislabeled: mislabeled.length,
          skipped,
          rows: mislabeled,
        },
        null,
        2
      )
    );
    return;
  }

  console.log("Mislabeled PDF audit");
  console.log("====================");
  console.log(`Scanned:     ${checked}`);
  console.log(`Valid PDFs:  ${valid}`);
  console.log(`Mislabeled:  ${mislabeled.length}`);
  if (skipped) console.log(`Skipped:     ${skipped}`);
  console.log("");

  if (!mislabeled.length) {
    console.log("No mislabeled PDFs found.");
    return;
  }

  const byKind = mislabeled.reduce(
    (acc, row) => {
      acc[row.content_kind] = (acc[row.content_kind] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log("By content kind:", byKind);
  console.log("");

  for (const row of mislabeled) {
    const created = row.created_at?.slice(0, 10) ?? "?";
    const size = row.file_size_bytes ?? "?";
    console.log(`- ${row.file_name}`);
    console.log(`  id: ${row.id}`);
    console.log(`  client: ${row.client_id}`);
    console.log(`  uploaded: ${created}  size: ${size} bytes  kind: ${row.content_kind}`);
    if (row.preview) console.log(`  preview: ${row.preview}`);
    if (row.error) console.log(`  error: ${row.error}`);
    console.log(`  path: ${row.storage_path}`);
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
