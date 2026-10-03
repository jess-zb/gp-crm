"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { EsignClientPrefill } from "@/lib/esign/map-client-prefill";
import type { EsignBindKey, EsignLayoutField } from "@/lib/esign/layout";
import { EsignDocumentBoard } from "@/app/components/esign/EsignDocumentBoard";
import { missingRequiredReviewLabels, reviewValuesFromPrefill } from "@/lib/esign/review-fields";
import { SignPageShell } from "../SignPageShell";

type ContextPayload = {
  title: string;
  signerName: string;
  prefill: EsignClientPrefill;
  fields: EsignLayoutField[];
  requiredBinds?: string[];
  midOptions: string[];
};

function valuesFromPrefill(p: EsignClientPrefill): Record<string, string> {
  return {
    ...reviewValuesFromPrefill(p),
    signedDate: new Date().toLocaleDateString("en-US"),
  };
}

export function SignDocumentClient({
  token,
  signerName,
  documentTitle,
}: {
  token: string;
  signerName: string;
  documentTitle: string;
}) {
  const [ctx, setCtx] = useState<ContextPayload | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [signaturePng, setSignaturePng] = useState<string | null>(null);
  const [placedSigIds, setPlacedSigIds] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [intent, setIntent] = useState(false);
  const [openSignatureRequest, setOpenSignatureRequest] = useState(0);
  const finishRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    void fetch("/api/sign/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    void fetch("/api/sign/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.prefill) return;
        const prefill = json.prefill as EsignClientPrefill;
        setCtx(json as ContextPayload);
        const next = valuesFromPrefill(prefill);
        if (!next.fullName.trim()) next.fullName = String(json.signerName || signerName).trim();
        setValues(next);
      })
      .catch(() => undefined);
  }, [token, signerName]);

  const fields = useMemo(() => ctx?.fields ?? [], [ctx]);
  const signatureFields = useMemo(
    () => fields.filter((f) => f.bind === "signature"),
    [fields]
  );
  const allSignaturesPlaced =
    signatureFields.length > 0 && signatureFields.every((f) => placedSigIds.includes(f.id));

  function pullToSignature(message: string) {
    setError(message);
    setOpenSignatureRequest((n) => n + 1);
  }

  async function submit() {
    if (!signaturePng || !intent) {
      pullToSignature("Please tap the highlighted signature box, then complete signing.");
      return;
    }
    if (!allSignaturesPlaced) {
      pullToSignature("Tap each remaining signature box to place your signature.");
      return;
    }
    if (ctx) {
      const missing = missingRequiredReviewLabels(
        { fields: ctx.fields, required_binds: ctx.requiredBinds ?? [] },
        values
      );
      if (missing.length) {
        setError(`Fill required fields: ${missing.join(", ")}`);
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sign/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          intentAccepted: true,
          signaturePng,
          signatureFieldIds: placedSigIds,
          fields: {
            ...ctx?.prefill,
            ...values,
            fullName: values.fullName,
          },
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Could not complete signing.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not complete signing.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <SignPageShell>
        <div className="crm-card p-8 text-center">
          <h1 className="crm-page-title text-[22px]">🎉 Thank you! 🎉</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Your {documentTitle.toLowerCase()} has been completed and we&apos;ve emailed the sign copy
            to your inbox.
          </p>
          <p className="mt-6 text-[15px] font-bold leading-5 text-slate-800 sm:text-base">
            Please advise your representative everything is done on your end.
          </p>
        </div>
      </SignPageShell>
    );
  }

  return (
    <SignPageShell>
      <div className="crm-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Electronic signature
        </p>
        <h1 className="mt-1 text-[22px] font-semibold text-[#0f172a]">{documentTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {allSignaturesPlaced ? (
            "Your signature is locked in. Tap Finish to complete this document."
          ) : signaturePng ? (
            <>
              Tap each remaining highlighted <strong>signature</strong> box to place it, then tap
              Finish.
            </>
          ) : (
            <>
              Hi {signerName}. Your details are already on this document. Tap a highlighted{" "}
              <strong>signature</strong> box, adopt your signature, then tap the other signature
              locations.
            </>
          )}
        </p>
      </div>

      {ctx ? (
        <div className="mt-5">
          <EsignDocumentBoard
            pdfUrl={`/api/sign/pdf?token=${encodeURIComponent(token)}`}
            fields={fields}
            mode="sign"
            values={values}
            midOptions={ctx.midOptions ?? []}
            signaturePreview={signaturePng}
            placedSignatureIds={placedSigIds}
            clientSigner
            openSignatureRequest={openSignatureRequest}
            intentCopy={`I intend to electronically sign this ${documentTitle.toLowerCase()} and agree that this signature is as valid as a wet-ink signature.`}
            onIntentAccepted={() => setIntent(true)}
            onValuesChange={(bind: EsignBindKey, value: string) => {
              setValues((prev) => ({ ...prev, [bind]: value }));
            }}
            onSignature={(png, fieldId) => {
              setSignaturePng(png);
              setPlacedSigIds((prev) => {
                const next = prev.includes(fieldId) ? prev : [...prev, fieldId];
                window.setTimeout(() => {
                  const remaining = signatureFields.filter((f) => !next.includes(f.id));
                  if (remaining.length === 0) {
                    finishRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    finishRef.current?.focus();
                  }
                }, 120);
                return next;
              });
            }}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-500">Loading document…</p>
      )}

      <div className="mt-8 flex flex-col items-center">
        {error ? <p className="mb-3 text-center text-sm font-medium text-red-600">{error}</p> : null}
        <button
          ref={finishRef}
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className={`crm-btn-primary !px-8 !py-2.5 !text-sm ${
            allSignaturesPlaced && !busy ? "ring-2 ring-[#8DE3B5] ring-offset-2" : ""
          }`}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Finish"
          )}
        </button>
      </div>
    </SignPageShell>
  );
}
