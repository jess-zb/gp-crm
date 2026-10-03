import type { PdfTextItem } from "./suggest-fields";

type PdfJsTextItem = {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
};

type PdfJsModule = {
  GlobalWorkerOptions?: { workerSrc: string };
  getDocument: (src: Record<string, unknown>) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getViewport: (opts: { scale: number }) => { width: number; height: number };
        getTextContent: () => Promise<{ items: PdfJsTextItem[] }>;
      }>;
      destroy?: () => Promise<void>;
    }>;
  };
};

/**
 * Text positions from a template PDF, in editor percentages (origin top-left).
 * pdfjs is pinned; this only reads the text layer, it does not render pages.
 */
function loadPdfJs(): PdfJsModule {
  // Next's bundler rewrites createRequire() into undefined, and a bundled
  // pdf.js cannot find ./pdf.worker.js. A runtime require loads the real package.
  const nodeRequire = eval("require") as NodeRequire;
  const pdfjs = nodeRequire("pdfjs-dist/legacy/build/pdf.js") as PdfJsModule;
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = nodeRequire.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.js"
    );
  }
  return pdfjs;
}

export async function extractPdfTextItems(bytes: Uint8Array): Promise<PdfTextItem[]> {
  const pdfjs = loadPdfJs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdf = await task.promise;
  const out: PdfTextItem[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const view = page.getViewport({ scale: 1 });
      if (view.width < 1 || view.height < 1) continue;
      const content = await page.getTextContent();
      for (const item of content.items) {
        const text = item.str ?? "";
        if (!text.trim()) continue;
        const transform = item.transform ?? [];
        const x = transform[4] ?? 0;
        const yBaseline = transform[5] ?? 0;
        const fontHeight = Math.abs(transform[3] ?? 0) || item.height || 0;
        if (fontHeight < 0.5) continue;
        const top = view.height - (yBaseline + fontHeight);
        out.push({
          page: pageNumber - 1,
          text,
          xPct: (x / view.width) * 100,
          yPct: (top / view.height) * 100,
          wPct: ((item.width ?? 0) / view.width) * 100,
          hPct: (fontHeight / view.height) * 100,
        });
      }
    }
  } finally {
    await pdf.destroy?.();
  }
  return out;
}
