"use client";

import { useEffect, useState } from "react";

export type PdfPageImage = { src: string; width: number; height: number };

export function usePdfPageImages(url: string | null) {
  const [pages, setPages] = useState<PdfPageImage[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setPages([]);
    setError("");

    async function run() {
      const pdfjsMod = await import("pdfjs-dist/legacy/build/pdf");
      const pdfjs = (pdfjsMod as { getDocument?: unknown; GlobalWorkerOptions?: { workerSrc: string } } & typeof pdfjsMod).default
        ? (pdfjsMod as { default: typeof pdfjsMod }).default
        : pdfjsMod;
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
      const pdf = await pdfjs.getDocument({ url, withCredentials: true }).promise;
      const next: PdfPageImage[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.45 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport }).promise;
        next.push({
          src: canvas.toDataURL("image/jpeg", 0.82),
          width: viewport.width,
          height: viewport.height,
        });
      }
      if (!cancelled) setPages(next);
    }

    run().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not load PDF");
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { pages, error };
}
