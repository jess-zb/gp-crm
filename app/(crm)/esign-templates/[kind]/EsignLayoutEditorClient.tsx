"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EsignDocumentBoard } from "@/app/components/esign/EsignDocumentBoard";
import { useMerchantOptions } from "@/lib/hooks/use-merchant-options";
import { defaultLayoutForKind, type EsignLayoutField } from "@/lib/esign/layout";
import { esignKindTitle, type EsignKind } from "@/lib/esign/types";

export function EsignLayoutEditorClient({ kind }: { kind: EsignKind }) {
  const [fields, setFields] = useState<EsignLayoutField[]>(defaultLayoutForKind(kind));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const midOptions = useMerchantOptions();
  const title = esignKindTitle(kind);

  useEffect(() => {
    void fetch(`/api/esign/layout?kind=${kind}`)
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.fields) && json.fields.length) setFields(json.fields);
      })
      .catch(() => undefined);
  }, [kind]);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/esign/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, fields }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(json.error || "Could not save");
        return;
      }
      setMessage("Saved. New sends will use these placements.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">E-Sign</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Place fields · {title}</h1>
      <p className="mt-2 text-sm text-slate-600">
        Drag Name, Account Manager, MID, card last 4, amounts, signature, and date onto the blank
        lines. Dropping a field opens a confirm box so you can pick what it fills. Drag a placed
        box to move it. Drag the bottom-right corner to resize — especially signatures, which
        stamp at the size of that box. Save, then send a new copy for the size to apply.
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link className="text-[#0A2540] underline" href="/esign-templates/cc_authorization">
          CC Auth
        </Link>
        <Link className="text-[#0A2540] underline" href="/esign-templates/welcome_packet">
          Welcome Packet
        </Link>
        <Link className="text-[#0A2540] underline" href="/esign-templates/ac_cc_authorization">
          AC CC Auth
        </Link>
        <Link className="text-[#0A2540] underline" href="/esign-templates/ac_welcome_packet">
          AC Welcome Packet
        </Link>
        <button
          type="button"
          className="rounded-lg bg-[#0A2540] px-3 py-1.5 text-xs font-semibold text-[#8DE3B5] disabled:opacity-60"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save placement"}
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      <div className="mt-6">
        <EsignDocumentBoard
          pdfUrl={`/api/esign/template-pdf?kind=${kind}`}
          fields={fields}
          mode="edit"
          values={{}}
          midOptions={midOptions}
          onFieldsChange={setFields}
        />
      </div>
    </div>
  );
}
