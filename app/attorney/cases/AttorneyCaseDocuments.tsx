"use client";

import { Download, Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { DocPreviewModal } from "@/app/components/DocPreviewModal";
import {
  downloadClientDocument,
  getClientDocumentPreviewUrl,
} from "@/lib/clients/document-download";
import { normalizeUploadMimeType } from "@/lib/clients/document-upload";
import { formatDateTimeOrDash } from "@/lib/utils/date";
import { toUserFacingError } from "@/lib/user-facing-error";

export type AttorneyCaseDocItem = {
  id: string;
  fileName: string;
  createdAt: string | null;
  mimeType: string | null;
  /** Human label e.g. POA, Collection letter, or document type */
  typeLabel: string;
};

type PreviewDoc = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
};

const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#0A2540] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#8DE3B5] dark:hover:bg-[#102840]";

export function AttorneyCaseDocuments({ docs }: { docs: AttorneyCaseDocItem[] }) {
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);

  async function onDownload(doc: AttorneyCaseDocItem) {
    try {
      // Attachment download — renames Shape text-as-PDF to *.pdf.txt
      await downloadClientDocument({
        documentId: doc.id,
        fileName: doc.fileName,
      });
    } catch (err) {
      window.alert(
        toUserFacingError(
          err instanceof Error ? err.message : "Could not download file."
        )
      );
    }
  }

  async function downloadAll() {
    if (docs.length === 0 || downloadBusy) return;
    setDownloadBusy(true);
    try {
      for (let i = 0; i < docs.length; i++) {
        const item = docs[i]!;
        await downloadClientDocument({
          documentId: item.id,
          fileName: item.fileName,
        });
        if (i < docs.length - 1) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    } catch (err) {
      window.alert(
        toUserFacingError(
          err instanceof Error ? err.message : "Could not download files."
        )
      );
    } finally {
      setDownloadBusy(false);
    }
  }

  function openPreview(doc: AttorneyCaseDocItem) {
    if (previewLoadingId) return;
    setPreviewLoadingId(doc.id);
    try {
      // Prefer same-origin stream over Storage signed URLs so attorneys are not
      // blocked by storage RLS / JWT expiry, and DocPreviewModal can sniff
      // real PDF vs Shape text-as-PDF vs .txt the same way as the CRM Uploads tab.
      setPreviewDoc({
        id: doc.id,
        fileName: doc.fileName,
        fileUrl: getClientDocumentPreviewUrl(doc.id),
        fileType: normalizeUploadMimeType(doc.fileName, doc.mimeType ?? ""),
      });
    } finally {
      setPreviewLoadingId(null);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Documents
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              All uploads for this client (PDF, TXT, and Shape text exports included)
            </p>
          </div>
          <button
            type="button"
            disabled={downloadBusy || docs.length === 0}
            onClick={() => void downloadAll()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0A2540] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-[#8DE3B5] dark:hover:bg-[#102840]"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {downloadBusy ? "Downloading…" : "Download All"}
          </button>
        </div>

        {docs.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
            No documents uploaded yet.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1a3550]">
                  <th className="pb-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">
                    File
                  </th>
                  <th className="pb-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">
                    Type
                  </th>
                  <th className="pb-2 pr-3 font-semibold text-slate-700 dark:text-slate-200">
                    Date
                  </th>
                  <th className="w-24 pb-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-slate-100 last:border-0 dark:border-[#1a3550]"
                  >
                    <td className="py-3 pr-3 font-medium text-slate-900 dark:text-slate-100">
                      <span className="line-clamp-2">{d.fileName}</span>
                    </td>
                    <td className="py-3 pr-3 text-slate-600 dark:text-slate-400">
                      {d.typeLabel}
                    </td>
                    <td className="py-3 pr-3 text-slate-600 dark:text-slate-400">
                      {formatDateTimeOrDash(d.createdAt)}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          disabled={previewLoadingId === d.id}
                          onClick={() => openPreview(d)}
                          aria-label={`Preview ${d.fileName}`}
                          title={`Preview ${d.fileName}`}
                          className={iconButtonClass}
                        >
                          {previewLoadingId === d.id ? (
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              strokeWidth={2}
                              aria-hidden
                            />
                          ) : (
                            <Eye className="h-4 w-4" strokeWidth={2} aria-hidden />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDownload(d)}
                          aria-label={`Download ${d.fileName}`}
                          title={`Download ${d.fileName}`}
                          className={iconButtonClass}
                        >
                          <Download
                            className="h-4 w-4"
                            strokeWidth={2}
                            aria-hidden
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {previewDoc ? (
        <DocPreviewModal
          documentId={previewDoc.id}
          fileName={previewDoc.fileName}
          fileUrl={previewDoc.fileUrl}
          fileType={previewDoc.fileType}
          onClose={() => setPreviewDoc(null)}
        />
      ) : null}
    </>
  );
}
