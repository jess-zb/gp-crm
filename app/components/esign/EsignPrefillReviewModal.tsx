"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { EsignTemplateRow } from "@/lib/esign/types";
import type { EsignClientPrefill } from "@/lib/esign/map-client-prefill";
import {
  missingRequiredReviewFields,
  reviewFieldsForTemplate,
  reviewValuesFromPrefill,
  snapshotFromReview,
  formatAdvisorNameForEsign,
  toTitleCaseName,
} from "@/lib/esign/review-fields";
import { formatUsd, formatUsdInput, isAmountField, parseUsdNumber } from "@/lib/esign/money";
import { ModalOverlay } from "@/app/components/ModalOverlay";
import { EsignSendPreview } from "@/app/components/esign/EsignSendPreview";
import type { EsignLayoutField } from "@/lib/esign/layout";

export function EsignPrefillReviewModal({
  template,
  prefill,
  midOptions,
  advisorOptions = [],
  confirmLabel,
  hideCancel,
  submitting = false,
  audience = "staff",
  preview = null,
  onCancel,
  onConfirm,
}: {
  template: Pick<EsignTemplateRow, "fields" | "required_binds">;
  prefill: EsignClientPrefill;
  midOptions: string[];
  advisorOptions?: string[];
  confirmLabel: string;
  audience?: "staff" | "signer";
  /** Staff send flow: live PDF beside the fields. Filling a field does not send. */
  preview?: {
    clientId: string;
    templateId: string;
    fields: EsignLayoutField[];
  } | null;
  hideCancel?: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (snapshot: Partial<EsignClientPrefill> & { fullName?: string }) => void;
}) {
  const [values, setValues] = useState(() => reviewValuesFromPrefill(prefill));
  const [amountFocus, setAmountFocus] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  const [locked, setLocked] = useState(false);
  const busy = submitting || locked;
  const fields = reviewFieldsForTemplate(template);
  const top = fields.filter((f) => f.group !== "card");
  const cards = fields.filter((f) => f.group === "card");
  const advisors = Array.from(
    new Set(
      [values.advisor, ...advisorOptions]
        .map((name) => formatAdvisorNameForEsign(name))
        .filter(Boolean)
    )
  );
  const missingKeys = new Set(missingRequiredReviewFields(template, values).map((f) => f.key));
  const highlightClass =
    "border-[#A87830] bg-[#A87830]/20 ring-1 ring-[#A87830]/50 focus:border-[#A87830] focus:ring-[#A87830]/40 dark:border-[#A87830] dark:bg-[#A87830]/10";

  useEffect(() => {
    setValues(reviewValuesFromPrefill(prefill));
  }, [prefill]);

  useEffect(() => {
    if (!nudge) return;
    const t = window.setTimeout(() => setNudge(false), 900);
    return () => window.clearTimeout(t);
  }, [nudge]);

  function setField(key: string, value: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (isAmountField(key)) {
        const total = [1, 2, 3, 4, 5]
          .map((n) => parseUsdNumber(next[`card${n}Amount`] || "") || 0)
          .reduce((sum, n) => sum + n, 0);
        if (key.startsWith("card") && total > 0) next.amountAuthorized = formatUsd(String(total));
      }
      return next;
    });
  }

  function renderField(field: (typeof fields)[number]) {
    const value = values[field.key] ?? "";
    const invalid = missingKeys.has(field.key);
    const controlClass = `${invalid ? highlightClass : ""} ${invalid && nudge ? "esign-missing-nudge" : ""}`;
    if (field.kind === "mid") {
      return (
        <select
          className={`crm-input mt-1 ${controlClass}`}
          required={field.required}
          aria-required={field.required || undefined}
          aria-invalid={invalid || undefined}
          value={value}
          onChange={(e) => setField(field.key, e.target.value)}
        >
          <option value="">Select MID</option>
          {midOptions.map((mid) => (
            <option key={mid} value={mid}>
              {mid}
            </option>
          ))}
        </select>
      );
    }
    if (field.kind === "advisor") {
      return (
        <select
          className={`crm-input mt-1 ${controlClass}`}
          required={field.required}
          aria-required={field.required || undefined}
          aria-invalid={invalid || undefined}
          value={value}
          onChange={(e) => setField(field.key, e.target.value)}
        >
          {value ? null : <option value="">Select account manager</option>}
          {advisors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      );
    }
    if (field.kind === "amount" || isAmountField(field.key, field.label)) {
      return (
        <div
          className={`mt-1 flex items-center rounded-md border bg-white transition-colors focus-within:ring-2 ${
            invalid
              ? `border-[#A87830] bg-[#A87830]/20 focus-within:border-[#A87830] focus-within:ring-[#A87830]/40 dark:bg-[#A87830]/10 ${nudge ? "esign-missing-nudge" : ""}`
              : "border-slate-200 focus-within:border-[#A87830] focus-within:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212]"
          }`}
        >
          <span className="pl-3 text-[13px] text-slate-500 dark:text-slate-400">$</span>
          <input
            inputMode="decimal"
            required={field.required}
            aria-required={field.required || undefined}
            aria-invalid={invalid || undefined}
            className="w-full rounded-md border-0 bg-transparent px-2 py-2 text-[13px] text-slate-900 outline-none dark:text-slate-100"
            value={formatUsdInput(value, amountFocus !== field.key)}
            onFocus={() => setAmountFocus(field.key)}
            onChange={(e) => setField(field.key, e.target.value)}
            onBlur={(e) => {
              setAmountFocus(null);
              setField(field.key, formatUsd(e.target.value));
            }}
          />
        </div>
      );
    }
    return (
      <input
        className={`crm-input mt-1 ${controlClass}`}
        required={field.required}
        aria-required={field.required || undefined}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => setField(field.key, e.target.value)}
        onBlur={(e) => {
          if (field.key === "fullName") setField(field.key, toTitleCaseName(e.target.value));
        }}
      />
    );
  }

  return (
    <ModalOverlay
      labelledBy="esign-review-title"
      className="z-[100] bg-black/40"
      onBackdropClick={busy || hideCancel ? undefined : onCancel}
    >
      <div className={`crm-modal-panel flex max-h-[calc(100vh-2rem)] flex-col p-0 ${preview ? "max-w-6xl" : "max-w-xl"}`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-[#2E2E2E]">
          <div>
            <h3 id="esign-review-title" className="crm-modal-title mb-0 text-[15px]">
              Confirm Before Sending
            </h3>
            <p className="crm-modal-subtitle mb-0 mt-1">
              {audience === "signer"
                ? "Confirm the starred fields, then fill in the rest. This prints on the document."
                : "Confirm the starred fields from the client file. The preview updates as you type. Nothing is sent until you press the button below."}
            </p>
          </div>
          {hideCancel ? null : (
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-[#242424] dark:hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto px-6 py-4 ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <div className={preview ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]" : ""}>
          {preview ? (
            <EsignSendPreview
              clientId={preview.clientId}
              templateId={preview.templateId}
              fields={preview.fields}
              basePrefill={prefill}
              values={values}
            />
          ) : null}
          <div>
          <div className="grid gap-4 sm:grid-cols-2">
            {top.map((field) => (
              <label
                key={field.key}
                className={`block text-sm ${
                  field.key === "fullName" || field.key === "advisor" ? "sm:col-span-2" : ""
                }`}
              >
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {field.label}
                  {field.required ? (
                    <span className="text-[#7A5620]" aria-hidden>
                      {" "}
                      *
                    </span>
                  ) : null}
                </span>
                {renderField(field)}
              </label>
            ))}
          </div>
          {cards.length ? (
            <div className="mt-5">
              <h4 className="mb-3 border-b border-slate-200 pb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#7A5620] dark:border-[#2E2E2E]">
                Cards
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {cards.map((field) => (
                  <label key={field.key} className="block text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {field.label}
                      {field.required ? (
                        <span className="text-[#7A5620]" aria-hidden>
                          {" "}
                          *
                        </span>
                      ) : null}
                    </span>
                    {renderField(field)}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-[#2E2E2E]">
          {hideCancel ? null : (
            <button
              type="button"
              className="crm-btn-secondary"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            aria-busy={busy}
            className="crm-btn-primary min-w-[9.5rem]"
            onClick={() => {
              if (busy) return;
              if (missingKeys.size) {
                setNudge(false);
                window.requestAnimationFrame(() => setNudge(true));
                return;
              }
              setLocked(true);
              onConfirm(snapshotFromReview(values));
            }}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {audience === "signer" ? "Please wait…" : "Sending…"}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
