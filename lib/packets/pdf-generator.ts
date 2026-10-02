const CHUNK_SIZE = 25;

function pdfEndpoint(): string {
  return (
    process.env.GOOGLE_SHEETS_PDF_ENDPOINT?.trim() ||
    "https://script.google.com/macros/s/AKfycbzqTGaWQuuQlI_oYr4_42FyLFPKMv0qvKhp8tEHIL2nhlyHrngrY-D7Huht04e2mCMF/exec"
  );
}

export type PdfClientPayload = {
  name: string;
  advisor: string;
  merchant: string;
};

/** PDF generator receives account manager first name only (not full name). */
export function advisorFirstNameForPdf(
  fullName: string | null | undefined
): string {
  const trimmed = fullName?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export async function callPdfGeneratorApi(
  clients: PdfClientPayload[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (clients.length === 0) return { success: true, count: 0 };

  const chunks: PdfClientPayload[][] = [];
  for (let i = 0; i < clients.length; i += CHUNK_SIZE) {
    chunks.push(clients.slice(i, i + CHUNK_SIZE));
  }

  let totalCount = 0;

  for (const chunk of chunks) {
    const url = pdfEndpoint();
    let text = "";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: chunk }),
        redirect: "follow",
        signal: AbortSignal.timeout(25_000),
      });

      text = await res.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[PdfGenerator] fetch error:", msg);
      return { success: false, count: totalCount, error: msg };
    }

    // Guard against Apps Script HTML error pages
    if (text.trim().startsWith("<")) {
      console.error("[PdfGenerator] HTML response (Apps Script error):", text.slice(0, 300));
      return {
        success: false,
        count: totalCount,
        error: "Apps Script returned an HTML error page",
      };
    }

    let parsed: { status?: string; count?: number; message?: string } = {};
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      console.error("[PdfGenerator] non-JSON response:", text.slice(0, 300));
      return {
        success: false,
        count: totalCount,
        error: `Non-JSON response: ${text.slice(0, 100)}`,
      };
    }

    if (parsed.status === "error") {
      console.error("[PdfGenerator] API error:", parsed.message);
      return {
        success: false,
        count: totalCount,
        error: parsed.message ?? "PDF generator returned error status",
      };
    }

    const chunkCount = parsed.count ?? chunk.length;
    totalCount += chunkCount;
    console.log("[PdfGenerator] chunk sent:", chunk.length, "reported count:", chunkCount, "total:", totalCount);
  }

  return { success: true, count: totalCount };
}
