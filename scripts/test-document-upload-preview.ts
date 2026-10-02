/**
 * Local smoke test for document upload + preview helpers (no browser auth required).
 *
 *   npx tsx scripts/test-document-upload-preview.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  hasPdfMagicBytes,
  isAllowedUploadFile,
  isLikelyTextContent,
  isMislabeledPdfContent,
  isPdfUpload,
  normalizeUploadMimeType,
} from "../lib/clients/document-upload";

config({ path: ".env.local" });

const BUCKET = "client-documents";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log("Document upload + preview smoke test\n");

  // --- unit checks ---
  const shapeText = "First name : WALTER\nLast name : WEAVER\nPhone : 6193022725\n";
  const shapeBytes = new TextEncoder().encode(shapeText);
  const realPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

  assert(isAllowedUploadFile({ type: "", name: "export.txt" }), ".txt allowed");
  assert(isAllowedUploadFile({ type: "text/plain;charset=utf-8", name: "export.txt" }), ".txt charset allowed");
  assert(isAllowedUploadFile({ type: "application/pdf", name: "WALTER WEAVER.pdf" }), "fake pdf allowed");
  assert(
    normalizeUploadMimeType("notes.txt", "application/octet-stream") === "text/plain",
    "normalize .txt mime"
  );
  assert(!hasPdfMagicBytes(shapeBytes), "shape export is not pdf magic");
  assert(hasPdfMagicBytes(realPdf), "real pdf magic");
  assert(isLikelyTextContent(shapeText), "shape text detected");
  assert(
    isMislabeledPdfContent("WALTER WEAVER.pdf", "application/pdf", shapeBytes),
    "mislabeled pdf detected for preview"
  );
  assert(!isPdfUpload("notes.txt", "text/plain"), "txt is not pdf upload label");
  console.log("  ✓ helper functions");

  // --- storage round-trip (fake pdf + txt) ---
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env vars");
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ts = Date.now();
  const paths: string[] = [];

  async function uploadAndVerify(
    label: string,
    fileName: string,
    content: string,
    browserMime: string
  ) {
    const mime = normalizeUploadMimeType(fileName, browserMime);
    assert(isAllowedUploadFile({ type: mime, name: fileName }), `${label}: allowed`);
    const path = `test/smoke-${ts}_${fileName.replace(/\s+/g, "_")}`;
    paths.push(path);

    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, content, {
      contentType: mime,
      upsert: false,
    });
    assert(!upErr, `${label}: storage upload — ${upErr?.message}`);

    const { data: signed, error: signErr } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(path, 120);
    assert(!signErr && signed?.signedUrl, `${label}: signed URL`);

    const headerRes = await fetch(signed!.signedUrl, {
      headers: { Range: "bytes=0-511" },
    });
    assert(headerRes.ok || headerRes.status === 206, `${label}: range fetch`);

    const header = new Uint8Array(await headerRes.arrayBuffer());
    const isPdf = isPdfUpload(fileName, mime);

    if (isPdf && !hasPdfMagicBytes(header)) {
      const fullRes = await fetch(signed!.signedUrl);
      const body = await fullRes.text();
      assert(isLikelyTextContent(body), `${label}: text preview path`);
    } else if (mime === "text/plain") {
      const fullRes = await fetch(signed!.signedUrl);
      const body = await fullRes.text();
      assert(body.includes("TEST"), `${label}: txt content readable`);
    } else {
      assert(hasPdfMagicBytes(header), `${label}: real pdf header`);
    }

    console.log(`  ✓ ${label}`);
  }

  await uploadAndVerify(
    "Shape export (.pdf)",
    "WALTER WEAVER.pdf",
    shapeText,
    "application/pdf"
  );
  await uploadAndVerify(
    "Plain text (.txt)",
    "shape-export.txt",
    "TEST client export line\n",
    "application/octet-stream"
  );
  await uploadAndVerify(
    "Real PDF header",
    "real-doc.pdf",
    "%PDF-1.4 fake body for smoke test",
    "application/pdf"
  );

  await sb.storage.from(BUCKET).remove(paths);
  console.log("  ✓ cleanup");

  console.log("\nAll smoke tests passed.");
}

main().catch((e) => {
  console.error("\nSmoke test FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
