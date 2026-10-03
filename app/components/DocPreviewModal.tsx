"use client";

import { Download, ExternalLink, FileText, Loader2, Mic, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  type DocumentContentKind,
  downloadClientDocument,
  openClientDocument,
  resolveDownloadFileName,
  sniffDocumentContentKind,
} from "@/lib/clients/document-download";

export type DocPreviewModalProps = {
  fileName: string;
  fileUrl: string;
  fileType: string;
  documentId?: string;
  onClose: () => void;
};

type PreviewState = "loading" | "ready" | "unavailable";

export function DocPreviewModal({
  fileName,
  fileUrl,
  fileType,
  documentId,
  onClose,
}: DocPreviewModalProps) {
  const [previewState, setPreviewState] = useState<PreviewState>("loading");
  const [contentKind, setContentKind] = useState<DocumentContentKind>("unknown");
  const [textContent, setTextContent] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [openBusy, setOpenBusy] = useState(false);

  const downloadFileName = resolveDownloadFileName(fileName, contentKind);

  useEffect(() => {
    let cancelled = false;
    setPreviewState("loading");
    setTextContent(null);

    (async () => {
      try {
        const kind = await sniffDocumentContentKind(fileName, fileType, fileUrl);
        if (cancelled) return;
        setContentKind(kind);

        if (kind === "text_as_pdf" || kind === "text") {
          const res = await fetch(fileUrl);
          if (cancelled) return;
          if (!res.ok) {
            setPreviewState("unavailable");
            return;
          }
          setTextContent(await res.text());
        }

        setPreviewState("ready");
      } catch {
        if (!cancelled) setPreviewState("unavailable");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileName, fileType, fileUrl]);

  const onDownload = useCallback(async () => {
    if (downloadBusy) return;
    setDownloadBusy(true);
    try {
      await downloadClientDocument({ fileName, documentId, fileUrl, contentKind });
    } catch (err) {
      console.error("[DocPreviewModal] download:", err);
      window.alert(
        err instanceof Error ? err.message : "Download failed. Please try again."
      );
    } finally {
      setDownloadBusy(false);
    }
  }, [contentKind, documentId, downloadBusy, fileName, fileUrl]);

  const onOpen = useCallback(async () => {
    if (openBusy) return;
    setOpenBusy(true);
    try {
      await openClientDocument({
        fileName,
        fileUrl,
        contentKind,
        textContent,
      });
    } catch (err) {
      console.error("[DocPreviewModal] open:", err);
      window.alert(
        err instanceof Error ? err.message : "Could not open file. Try Download instead."
      );
    } finally {
      setOpenBusy(false);
    }
  }, [contentKind, fileName, fileUrl, openBusy, textContent]);

  const showPdfIframe = previewState === "ready" && contentKind === "pdf";
  const showTextPreview =
    previewState === "ready" &&
    (contentKind === "text_as_pdf" || contentKind === "text") &&
    textContent;
  const showImage = previewState === "ready" && contentKind === "image";
  const showAudio = previewState === "ready" && contentKind === "audio";
  const showVideo = previewState === "ready" && contentKind === "video";
  const showFallback =
    previewState === "unavailable" ||
    (previewState === "ready" &&
      !showPdfIframe &&
      !showTextPreview &&
      !showImage &&
      !showAudio &&
      !showVideo);

  const downloadButton = (
    <button
      type="button"
      onClick={() => void onDownload()}
      disabled={downloadBusy}
      title={`Download ${downloadFileName}`}
      className="crm-btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60"
    >
      {downloadBusy ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5 shrink-0" />
      )}
      {downloadFileName === fileName ? "Download" : `Download ${downloadFileName}`}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl dark:border dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#2E2E2E]">
          <p
            id="doc-preview-title"
            className="max-w-md truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            {fileName}
          </p>
          <div className="flex items-center gap-2">
            {downloadButton}
            <button
              type="button"
              onClick={() => void onOpen()}
              disabled={openBusy}
              title={
                downloadFileName === fileName
                  ? `Open ${fileName}`
                  : `Open as ${downloadFileName}`
              }
              className="crm-btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {openBusy ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              )}
              Open
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-[#242424]"
              aria-label="Close preview"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-b-xl bg-slate-50 dark:bg-[#121212]/60">
          {previewState === "loading" ? (
            <div className="flex min-h-[320px] items-center justify-center p-8 text-sm text-slate-500">
              Loading preview…
            </div>
          ) : null}

          {showPdfIframe ? (
            <iframe
              src={fileUrl}
              className="h-full min-h-[600px] w-full"
              title={fileName}
            />
          ) : null}

          {showTextPreview ? (
            <div className="p-6">
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 font-mono text-xs text-slate-800 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-100">
                {textContent}
              </pre>
            </div>
          ) : null}

          {showImage ? (
            <div className="flex h-full min-h-[320px] items-center justify-center p-8">
              <img
                src={fileUrl}
                alt={fileName}
                className="max-h-full max-w-full rounded-lg object-contain shadow-md"
              />
            </div>
          ) : null}

          {showAudio ? (
            <div className="flex items-center justify-center p-8">
              <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-sm dark:border dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
                  <Mic className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {fileName}
                </p>
                <audio controls className="w-full" src={fileUrl}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            </div>
          ) : null}

          {showVideo ? (
            <div className="flex h-full min-h-[320px] items-center justify-center p-4">
              <video
                controls
                className="max-h-full max-w-full rounded-lg"
                src={fileUrl}
              >
                Your browser does not support video playback.
              </video>
            </div>
          ) : null}

          {showFallback ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                {fileName}
              </p>
              <p className="mb-6 text-xs text-slate-400">
                Preview not available — you can still download the original file.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void onDownload()}
                  disabled={downloadBusy}
                  title={`Download ${downloadFileName}`}
                  className="crm-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
                >
                  {downloadBusy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 shrink-0" />
                  )}
                  Download {downloadFileName}
                </button>
                <button
                  type="button"
                  onClick={() => void onOpen()}
                  disabled={openBusy}
                  className="crm-btn-secondary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  Open in New Tab
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
