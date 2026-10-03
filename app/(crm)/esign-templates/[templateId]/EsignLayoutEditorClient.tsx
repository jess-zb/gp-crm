"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EsignDocumentBoard } from "@/app/components/esign/EsignDocumentBoard";
import { BIND_LABELS, type EsignBindKey, type EsignLayoutField } from "@/lib/esign/layout";
import { mergeSuggestedFields } from "@/lib/esign/suggest-fields";

export function EsignLayoutEditorClient({
  templateId,
  templateName,
  midName,
  backHref,
}: {
  templateId: string;
  templateName: string;
  midName: string;
  backHref: string;
}) {
  const [fields, setFields] = useState<EsignLayoutField[]>([]);
  const [ready, setReady] = useState(false);
  const [required, setRequired] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch(`/api/esign/layout?templateId=${encodeURIComponent(templateId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.fields)) setFields(json.fields);
        if (Array.isArray(json.requiredBinds)) setRequired(json.requiredBinds.map(String));
      })
      .catch(() => setMessage("Could not load the current placement."))
      .finally(() => setReady(true));
  }, [templateId]);

  const placedBinds = useMemo(() => {
    const seen = new Set<EsignBindKey>();
    for (const field of fields) {
      if (field.bind === "signature" || field.bind === "signedDate") continue;
      seen.add(field.bind);
    }
    return Array.from(seen);
  }, [fields]);

  function toggleRequired(bind: string) {
    setRequired((prev) =>
      prev.includes(bind) ? prev.filter((b) => b !== bind) : [...prev, bind]
    );
  }

  async function suggest() {
    setSuggesting(true);
    setMessage("");
    try {
      const res = await fetch("/api/esign/suggest-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const json = (await res.json()) as { error?: string; fields?: EsignLayoutField[] };
      if (!res.ok || !Array.isArray(json.fields)) {
        setMessage(json.error || "Could not read labels on this PDF.");
        return;
      }
      const merged = mergeSuggestedFields(fields, json.fields);
      const added = merged.length - fields.length;
      setFields(merged);
      setMessage(
        added
          ? `Placed ${added} general field${added === 1 ? "" : "s"}. Move or remove any that landed in the wrong spot, drag on anything else, then save.`
          : json.fields.length
            ? "Those general fields are already on the page. Drag on anything else, then save."
            : "No name, address, or similar labels were found. Drag the fields this document needs, then save."
      );
    } catch {
      setMessage("Could not read labels on this PDF.");
    } finally {
      setSuggesting(false);
    }
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/esign/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          fields,
          requiredBinds: required.filter((bind) => placedBinds.includes(bind as EsignBindKey)),
        }),
      });
      const json = (await res.json()) as { error?: string; requiredBinds?: string[] };
      if (!res.ok) {
        setMessage(json.error || "Could not save");
        return;
      }
      if (Array.isArray(json.requiredBinds)) setRequired(json.requiredBinds);
      setMessage("Saved. New sends will use these placements.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {midName} · E-Sign
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Place fields · {templateName}</h1>
      <p className="mt-2 text-sm text-slate-600">
        Name, address, email, phone, date, and signature are placed from labels on the PDF when
        you upload. Use Suggest general fields to scan again. Drag cards, amounts, and anything
        the scan missed onto the page. Click a box to change what it fills or remove it. Drag a
        box to move it, and drag the corner to resize. Save, then send a new copy.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <Link className="text-[#161616] underline" href={backHref}>
          Back to {midName}
        </Link>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
          disabled={busy || suggesting || !ready}
          onClick={() => void suggest()}
        >
          {suggesting ? "Scanning…" : "Suggest general fields"}
        </button>
        <button
          type="button"
          className="rounded-lg bg-[#161616] px-3 py-1.5 text-xs font-semibold text-[#A87830] disabled:opacity-60"
          disabled={busy || suggesting}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save placement"}
        </button>
      </div>
      {placedBinds.length ? (
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Required before sending
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {placedBinds.map((bind) => (
              <label key={bind} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={required.includes(bind)}
                  onChange={() => toggleRequired(bind)}
                />
                {BIND_LABELS[bind]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      <div className="mt-6">
        <EsignDocumentBoard
          pdfUrl={`/api/esign/template-pdf?templateId=${encodeURIComponent(templateId)}`}
          fields={fields}
          mode="edit"
          values={{}}
          midOptions={[midName]}
          onFieldsChange={setFields}
        />
      </div>
    </div>
  );
}
