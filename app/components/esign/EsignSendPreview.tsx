"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { EsignDocumentBoard } from "@/app/components/esign/EsignDocumentBoard";
import type { EsignLayoutField } from "@/lib/esign/layout";
import type { EsignClientPrefill } from "@/lib/esign/map-client-prefill";
import { snapshotFromReview } from "@/lib/esign/review-fields";

export function EsignSendPreview({
  clientId,
  templateId,
  fields,
  basePrefill,
  values,
}: {
  clientId: string;
  templateId: string;
  fields: EsignLayoutField[];
  basePrefill: EsignClientPrefill;
  values: Record<string, string>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const placed = fields.length > 0;

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      const snapshot = snapshotFromReview(values);
      const prefill = { ...basePrefill, ...snapshot };
      void (async () => {
        try {
          const res = await fetch("/api/esign/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, templateId, prefill }),
          });
          if (!res.ok) {
            const json = (await res.json().catch(() => null)) as { error?: string } | null;
            if (!cancelled) {
              setError(json?.error || "Could not load the document");
              setLoading(false);
            }
            return;
          }
          const blob = await res.blob();
          const nextUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(nextUrl);
            return;
          }
          setUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return nextUrl;
          });
          setError("");
          setLoading(false);
        } catch {
          if (!cancelled) {
            setError("Could not load the document");
            setLoading(false);
          }
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [basePrefill, clientId, templateId, values]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Document preview
      </p>
      {placed ? (
        <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
          Values print in the same places the client will see. Signing boxes stay blank until they sign.
        </p>
      ) : (
        <p className="mt-1 text-[12px] leading-5 text-amber-800 dark:text-amber-300">
          The boxes have not been placed on this document.
        </p>
      )}
      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {loading && !url ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading document…
        </p>
      ) : null}
      {url ? (
        <div className="mt-3 max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-[#2E2E2E] dark:bg-[#121212]">
          <EsignDocumentBoard
            pdfUrl={url}
            fields={fields}
            mode="sign"
            values={{}}
            midOptions={[]}
            readOnly
          />
        </div>
      ) : null}
    </div>
  );
}
