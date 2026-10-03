"use client";

import { useEffect, useRef, useState } from "react";
import type { EsignBindKey } from "@/lib/esign/layout";
import { BIND_LABELS, ESIGN_BIND_KEYS } from "@/lib/esign/layout";
import { formatUsd, formatUsdInput, isAmountField } from "@/lib/esign/money";

import { typedSignaturePng, trimSignatureCanvas } from "./typedSignaturePng";

export function EsignFieldConfirmModal({
  bind,
  label,
  value,
  midOptions,
  allowBindChange,
  onCancel,
  onConfirm,
  onRemove,
  intentCopy,
  onIntentAccepted,
}: {
  bind: EsignBindKey;
  label: string;
  value: string;
  midOptions: string[];
  allowBindChange?: boolean;
  onCancel: () => void;
  onConfirm: (next: string, signaturePng?: string, nextBind?: EsignBindKey) => void;
  onRemove?: () => void;
  intentCopy?: string;
  onIntentAccepted?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [bindDraft, setBindDraft] = useState(bind);
  const [signMode, setSignMode] = useState<"type" | "draw">("type");
  const [amountFocused, setAmountFocused] = useState(false);
  const [intentOk, setIntentOk] = useState(false);
  const [intentError, setIntentError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    setDraft(value);
    setBindDraft(bind);
    setSignMode("type");
  }, [value, bind]);

  useEffect(() => {
    if (allowBindChange || bind !== "signature" || signMode !== "type") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111827";
    ctx.font = "italic 56px Georgia, 'Times New Roman', serif";
    ctx.fillText(draft.trim() || " ", 20, 92);
  }, [allowBindChange, bind, draft, signMode]);

  function pointer(e: React.PointerEvent<HTMLCanvasElement>, mode: "down" | "move" | "up") {
    if (signMode !== "draw") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    if (mode === "down") {
      drawing.current = true;
      canvas.setPointerCapture(e.pointerId);
      ctx.beginPath();
      ctx.moveTo(x, y);
      return;
    }
    if (mode === "up") {
      drawing.current = false;
      return;
    }
    if (!drawing.current) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl"
        style={{ colorScheme: "light" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm field</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">{label}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {allowBindChange
            ? "Choose what this box should fill, then confirm."
            : "Check this matches the client file, then place it on the document."}
        </p>

        {allowBindChange ? (
          <select
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={bindDraft}
            onChange={(e) => setBindDraft(e.target.value as EsignBindKey)}
          >
            {ESIGN_BIND_KEYS.map((key) => (
              <option key={key} value={key}>
                {BIND_LABELS[key]}
              </option>
            ))}
          </select>
        ) : bind === "signature" ? (
          <div className="mt-4">
            <div className="mb-3 flex gap-2 text-xs font-semibold">
              <button
                type="button"
                className={`rounded-full px-3 py-1 ${
                  signMode === "type" ? "bg-[#161616] text-[#A87830]" : "bg-slate-100 text-slate-600"
                }`}
                onClick={() => setSignMode("type")}
              >
                Type
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 ${
                  signMode === "draw" ? "bg-[#161616] text-[#A87830]" : "bg-slate-100 text-slate-600"
                }`}
                onClick={() => {
                  setSignMode("draw");
                  const canvas = canvasRef.current;
                  const ctx = canvas?.getContext("2d");
                  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                }}
              >
                Draw
              </button>
            </div>
            {signMode === "type" ? (
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                placeholder="Type your name to sign"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            ) : null}
            <canvas
              ref={canvasRef}
              width={520}
              height={140}
              className={`mt-3 h-36 w-full rounded-xl border border-slate-300 ${
                signMode === "draw" ? "cursor-crosshair touch-none" : "pointer-events-none bg-slate-50"
              }`}
              onPointerDown={(e) => pointer(e, "down")}
              onPointerMove={(e) => pointer(e, "move")}
              onPointerUp={(e) => pointer(e, "up")}
            />
            {intentCopy ? (
              <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#161616]"
                  checked={intentOk}
                  onChange={(e) => {
                    setIntentOk(e.target.checked);
                    if (e.target.checked) setIntentError(false);
                  }}
                />
                <span>{intentCopy}</span>
              </label>
            ) : null}
            {intentError ? (
              <p className="mt-2 text-sm font-medium text-red-600">
                Check the box above to adopt this signature.
              </p>
            ) : null}
          </div>
        ) : bind === "mid" ? (
          <select
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          >
            <option value="">Select MID</option>
            {midOptions.map((mid) => (
              <option key={mid} value={mid}>
                {mid}
              </option>
            ))}
          </select>
        ) : isAmountField(bindDraft, BIND_LABELS[bindDraft]) ? (
          <div className="mt-4 flex items-center rounded-lg border border-slate-200">
            <span className="pl-3 text-sm text-slate-500">$</span>
            <input
              inputMode="decimal"
              className="w-full rounded-lg border-0 bg-white px-2 py-2 text-sm font-medium text-slate-900 outline-none"
              value={formatUsdInput(draft, !amountFocused)}
              onFocus={() => setAmountFocused(true)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => {
                setAmountFocused(false);
                setDraft(formatUsd(e.target.value));
              }}
            />
          </div>
        ) : (
          <input
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          {onRemove ? (
            <button type="button" className="text-xs text-red-600 underline" onClick={onRemove}>
              Remove field
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
          <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-600" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#161616] px-4 py-2 text-sm font-semibold text-[#A87830]"
            onClick={() => {
              if (!allowBindChange && bind === "signature") {
                if (intentCopy && !intentOk) {
                  setIntentError(true);
                  return;
                }
                const png =
                  signMode === "type"
                    ? typedSignaturePng(draft)
                    : canvasRef.current
                      ? trimSignatureCanvas(canvasRef.current)
                      : undefined;
                if (intentOk) onIntentAccepted?.();
                onConfirm(draft, png, bindDraft);
                return;
              }
              onConfirm(isAmountField(bindDraft) ? formatUsd(draft) : draft, undefined, bindDraft);
            }}
          >
            {allowBindChange || bind !== "signature" ? "Confirm" : "Adopt & Sign"}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
