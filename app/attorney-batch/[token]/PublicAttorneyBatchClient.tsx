"use client";

import { useState } from "react";
import type { PublicBatchClient } from "@/lib/attorney-queue/public-batch";

function clientName(c: PublicBatchClient) {
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client";
}

function kindLabel(kind: "poa" | "collection_letter" | "other") {
  if (kind === "poa") return "POA";
  if (kind === "collection_letter") return "Collection letter";
  return "File";
}

/** Trigger a browser download via the API redirect (no blob proxy). */
function triggerDownload(url: string) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    iframe.remove();
  }, 60_000);
}

export function PublicAttorneyBatchClient({
  token,
  clients,
}: {
  token: string;
  clients: PublicBatchClient[];
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const allDocs = clients.flatMap((c) =>
    c.documents.map((d) => ({
      ...d,
      clientLabel: clientName(c),
    }))
  );

  function downloadHref(documentId: string) {
    // Cache-bust so CDNs never reuse a prior failed/expired download response.
    return `/api/attorney-batch/${encodeURIComponent(token)}/download?documentId=${encodeURIComponent(documentId)}&t=${Date.now()}`;
  }

  async function downloadAll() {
    if (allDocs.length === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      for (let i = 0; i < allDocs.length; i++) {
        const d = allDocs[i];
        setStatus(`Downloading ${i + 1} of ${allDocs.length}…`);
        triggerDownload(downloadHref(d.id));
        await new Promise((r) => setTimeout(r, 600));
      }
      setStatus(
        `Started ${allDocs.length} download${allDocs.length === 1 ? "" : "s"}.`
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || allDocs.length === 0}
          onClick={() => void downloadAll()}
          className="rounded-lg bg-[#8DE3B5] px-4 py-2 text-sm font-semibold text-[#0A2540] disabled:opacity-50"
        >
          {busy ? "Downloading…" : `Download all (${allDocs.length})`}
        </button>
        {status ? (
          <p className="text-xs text-slate-300" role="status">
            {status}
          </p>
        ) : null}
      </div>

      {clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#1a3550] bg-[#0d2035] px-4 py-10 text-center text-sm text-slate-400">
          This batch has no files.
        </p>
      ) : (
        clients.map((c) => (
          <section
            key={c.id}
            className="rounded-xl border border-[#1a3550] bg-[#0d2035] p-4"
          >
            <h2 className="text-base font-semibold text-white">
              {clientName(c)}
            </h2>
            <ul className="mt-3 divide-y divide-[#1a3550]">
              {c.documents.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#E8EAEE]">
                      {d.file_name}
                    </p>
                    <p className="text-xs text-slate-400">{kindLabel(d.kind)}</p>
                  </div>
                  <a
                    href={downloadHref(d.id)}
                    className="shrink-0 rounded-md border border-[#8DE3B5]/40 px-3 py-1.5 text-xs font-semibold text-[#8DE3B5] hover:bg-[#8DE3B5]/10"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
