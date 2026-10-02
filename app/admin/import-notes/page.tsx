"use client";

import { useCallback, useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, CheckCircle, XCircle, FileText, Loader2 } from "lucide-react";

/** Lowercase keys for Shape `CreatedBy` email matching. */
const CREATOR_MAP: Record<string, string> = {
  "cliff@catacosm.com": "support@debtsupportpros.com",
  "lindsey@debtsupportpros.com": "lindsey@debtsupportpros.com",
  "marissa@debtsupportpros.com": "marissa@debtsupportpros.com",
  "caleb@debtsupportpros.com": "caleb@debtsupportpros.com",
  "emile@debtsupportpros.com": "emile@debtsupportpros.com",
  "sandi@debtsupportpros.com": "sandi@debtsupportpros.com",
  "sam@debtsupportpros.com": "samantha@debtsupportpros.com",
  "samantha@debtsupportpros.com": "samantha@debtsupportpros.com",
  "aaron@debtsupportpros.com": "aaron@debtsupportpros.com",
  "maya@debtsupportpros.com": "maya@debtsupportpros.com",
  "bobby@debtsupportpros.com": "bobby@debtsupportpros.com",
  "haydenrosene25@yahoo.com": "haydenrosene25@yahoo.com",
};

type MappedNote = {
  phone: string;
  body: string;
  created_at: string;
  creator_email: string;
};

type Stage = "idle" | "parsing" | "preview" | "importing" | "done";

function normalizePhone(p: string): string | null {
  const d = p.replace(/\D/g, "");
  if (d.length === 10)
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1")
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

export default function ImportNotesPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [clientsFile, setClientsFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<MappedNote[]>([]);
  const [totalNotes, setTotalNotes] = useState(0);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({
    imported: 0,
    skipped: 0,
    errors: 0,
  });
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const notesRef = useRef<MappedNote[] | null>(null);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.endsWith(".csv")
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const parseAndPreview = async () => {
    if (!clientsFile || files.length === 0) return;
    setStage("parsing");

    const clientsData = await new Promise<Record<string, string>[]>(
      (resolve, reject) => {
        Papa.parse<Record<string, string>>(clientsFile, {
          header: true,
          skipEmptyLines: true,
          complete: (r) => resolve((r.data as Record<string, string>[]) ?? []),
          error: (err) => reject(err),
        });
      }
    );

    const leadPhoneMap: Record<string, string> = {};
    for (const r of clientsData) {
      const lid = (r["Lead ID"] || r["LeadId"] || "").trim();
      const rawPhone = r["Mobile Phone"] || "";
      const phone = normalizePhone(String(rawPhone));
      if (lid && phone) leadPhoneMap[lid] = phone;
    }

    let allNotes: Record<string, string>[] = [];
    for (const file of files) {
      const data = await new Promise<Record<string, string>[]>(
        (resolve, reject) => {
          Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (r) =>
              resolve((r.data as Record<string, string>[]) ?? []),
            error: (err) => reject(err),
          });
        }
      );
      allNotes = allNotes.concat(data);
    }

    const mapped: MappedNote[] = [];
    for (const n of allNotes) {
      const lid = (n.LeadId || "").trim();
      const phone = leadPhoneMap[lid];
      const body = stripHtml(n.Comment || "");
      const created = n.Createdon || "";
      const creatorKey = (n.CreatedBy || "").trim().toLowerCase();
      if (!phone || !body || body.length < 2) continue;
      if (created === "0000-00-00 00:00:00") continue;

      let created_at = "2025-08-14T12:00:00.000Z";
      const parsed = new Date(created);
      if (!Number.isNaN(parsed.getTime())) {
        created_at = parsed.toISOString();
      }

      mapped.push({
        phone,
        body: body.slice(0, 3000),
        created_at,
        creator_email:
          CREATOR_MAP[creatorKey] ?? "support@debtsupportpros.com",
      });
    }

    notesRef.current = mapped;
    setTotalNotes(mapped.length);
    setPreview(mapped.slice(0, 5));
    setStage("preview");
  };

  const runImport = async () => {
    const notes = notesRef.current;
    if (!notes?.length) return;
    setStage("importing");

    const BATCH_SIZE = 500;
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errLog: string[] = [];

    for (let i = 0; i < notes.length; i += BATCH_SIZE) {
      const batch = notes.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch("/api/admin/import-notes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ notes: batch }),
        });
        const data = (await res.json()) as {
          imported?: number;
          skipped?: number;
          errors?: number;
          error?: string;
        };
        if (!res.ok) {
          errLog.push(
            `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${data.error ?? res.statusText}`
          );
          errors += batch.length;
        } else {
          imported += data.imported ?? 0;
          skipped += data.skipped ?? 0;
          errors += data.errors ?? 0;
        }
      } catch (e) {
        errLog.push(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${e instanceof Error ? e.message : String(e)}`
        );
        errors += batch.length;
      }
      setProgress(
        Math.min(
          100,
          Math.round(((i + batch.length) / notes.length) * 100)
        )
      );
    }

    setResults({ imported, skipped, errors });
    setErrorLog(errLog);
    setStage("done");
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          Notes Importer
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Dev only — import Shape CRM notes in bulk
        </p>
      </div>

      {stage === "idle" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#1a3550] dark:bg-[#0d2035]">
            <h2 className="mb-3 font-semibold text-gray-800 dark:text-slate-100">
              Step 1 — Upload Clients CSV
            </h2>
            <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">
              The export with Lead ID + Mobile Phone — maps Lead IDs to phone
              numbers
            </p>
            <input
              type="file"
              accept="*/*"
              onChange={(e) =>
                setClientsFile(e.target.files?.[0] ?? null)
              }
              className="text-sm text-gray-600 dark:text-slate-300"
            />
            {clientsFile ? (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                ✓ {clientsFile.name}
              </p>
            ) : null}
          </div>

          <div
            className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center transition-colors hover:border-[#8DE3B5] dark:border-[#1a3550] dark:bg-[#0d2035]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
          >
            <Upload className="mx-auto mb-3 h-8 w-8 text-gray-400" />
            <h2 className="mb-1 font-semibold text-gray-800 dark:text-slate-100">
              Step 2 — Drop Notes CSVs Here
            </h2>
            <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">
              e.g. notes_sales.csv, notes_service.csv
            </p>
            <input
              type="file"
              accept="*/*"
              multiple
              onChange={(e) =>
                setFiles(Array.from(e.target.files ?? []))
              }
              className="text-sm text-gray-600 dark:text-slate-300"
            />
            {files.length > 0 ? (
              <div className="mt-3 space-y-1">
                {files.map((f) => (
                  <p
                    key={f.name}
                    className="text-xs text-green-600 dark:text-green-400"
                  >
                    ✓ {f.name}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void parseAndPreview()}
            disabled={!clientsFile || files.length === 0}
            className="w-full rounded-xl bg-[#8DE3B5] py-3 font-medium text-[#0A2540] disabled:opacity-40"
          >
            Parse & Preview
          </button>
        </div>
      )}

      {stage === "parsing" && (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#8DE3B5]" />
          <p className="text-gray-600 dark:text-slate-300">Parsing CSVs...</p>
        </div>
      )}

      {stage === "preview" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <p className="font-semibold text-green-800 dark:text-green-200">
              {totalNotes.toLocaleString()} notes ready to import
            </p>
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              Duplicates (same client + sent_at + type note) are skipped
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-[#1a3550] dark:bg-[#0d2035]">
            <div className="border-b border-gray-100 px-4 py-3 dark:border-[#1a3550]">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                Preview (first 5)
              </p>
            </div>
            {preview.map((n, i) => (
              <div
                key={`${n.phone}-${n.created_at}-${i}`}
                className="border-b border-gray-50 px-4 py-3 text-sm last:border-0 dark:border-[#1a3550]/60"
              >
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {n.phone} · {n.created_at?.slice(0, 10)} · {n.creator_email}
                </p>
                <p className="mt-1 line-clamp-2 text-gray-800 dark:text-slate-200">
                  {n.body}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void runImport()}
            className="w-full rounded-xl bg-[#8DE3B5] py-3 font-medium text-[#0A2540]"
          >
            Import {totalNotes.toLocaleString()} Notes
          </button>
        </div>
      )}

      {stage === "importing" && (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#8DE3B5]" />
          <p className="mb-3 font-medium text-gray-700 dark:text-slate-200">
            Importing notes...
          </p>
          <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-[#1a3550]">
            <div
              className="h-3 rounded-full bg-[#8DE3B5] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            {progress}%
          </p>
        </div>
      )}

      {stage === "done" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950/30">
              <CheckCircle className="mx-auto mb-1 h-6 w-6 text-green-600" />
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {results.imported.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Imported
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center dark:border-[#1a3550] dark:bg-[#102840]">
              <FileText className="mx-auto mb-1 h-6 w-6 text-gray-400" />
              <p className="text-2xl font-bold text-gray-700 dark:text-slate-200">
                {results.skipped.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Skipped</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950/30">
              <XCircle className="mx-auto mb-1 h-6 w-6 text-red-500" />
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {results.errors.toLocaleString()}
              </p>
              <p className="text-xs text-red-500 dark:text-red-400">Errors</p>
            </div>
          </div>
          {errorLog.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {errorLog.map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setStage("idle");
              setFiles([]);
              setClientsFile(null);
              setProgress(0);
              notesRef.current = null;
              setErrorLog([]);
            }}
            className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 dark:border-[#1a3550] dark:text-slate-200"
          >
            Import More Files
          </button>
        </div>
      )}
    </div>
  );
}
