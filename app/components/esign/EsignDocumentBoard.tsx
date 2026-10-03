"use client";

import { useEffect, useRef, useState } from "react";
import {
  BIND_LABELS,
  defaultSizeForBind,
  type EsignBindKey,
  type EsignLayoutField,
} from "@/lib/esign/layout";
import { formatUsd, isAmountField } from "@/lib/esign/money";
import { usePdfPageImages } from "./usePdfPageImages";
import { EsignFieldConfirmModal } from "./EsignFieldConfirmModal";

const PALETTE: EsignBindKey[] = [
  "fullName",
  "advisor",
  "mid",
  "amountAuthorized",
  "card1Last4",
  "card1Amount",
  "card2Last4",
  "card2Amount",
  "card3Last4",
  "card3Amount",
  "card4Last4",
  "card4Amount",
  "card5Last4",
  "card5Amount",
  "signedDate",
  "signature",
];

export function EsignDocumentBoard({
  pdfUrl,
  fields,
  mode,
  values,
  midOptions,
  signaturePreview,
  placedSignatureIds = [],
  clientSigner = false,
  readOnly = false,
  openSignatureRequest = 0,
  intentCopy,
  onIntentAccepted,
  onFieldsChange,
  onValuesChange,
  onSignature,
}: {
  pdfUrl: string;
  fields: EsignLayoutField[];
  mode: "edit" | "sign";
  values: Record<string, string>;
  midOptions: string[];
  signaturePreview?: string | null;
  placedSignatureIds?: string[];
  clientSigner?: boolean;
  /** Staff preview: show the flattened PDF and signature boxes, without signing. */
  readOnly?: boolean;
  openSignatureRequest?: number;
  intentCopy?: string;
  onIntentAccepted?: () => void;
  onFieldsChange?: (fields: EsignLayoutField[]) => void;
  onValuesChange?: (bind: EsignBindKey, value: string) => void;
  onSignature?: (png: string, fieldId: string) => void;
}) {
  const { pages, error } = usePdfPageImages(pdfUrl);
  const [active, setActive] = useState<EsignLayoutField | null>(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const interact = useRef<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    orig: EsignLayoutField;
    pageEl: HTMLElement;
  } | null>(null);
  const skipClick = useRef(false);
  const sigBtnRef = useRef<HTMLButtonElement | null>(null);
  const autoOpened = useRef(false);
  const placed = new Set(placedSignatureIds);
  const nextUnsigned = fields.find((f) => f.bind === "signature" && !placed.has(f.id));

  const visibleFields = (pageIndex: number) =>
    fields.filter((f) => {
      if (f.page !== pageIndex) return false;
      if (clientSigner || readOnly) return f.bind === "signature";
      return true;
    });

  function openSignature() {
    if (!nextUnsigned) return;
    window.requestAnimationFrame(() => {
      sigBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    if (clientSigner && signaturePreview) return;
    setActive(nextUnsigned);
  }

  useEffect(() => {
    if (readOnly || !clientSigner || !pages.length || autoOpened.current) return;
    autoOpened.current = true;
    openSignature();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSigner, pages.length]);

  useEffect(() => {
    if (!clientSigner || openSignatureRequest < 1) return;
    openSignature();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignatureRequest]);

  function pctOnPage(
    pageEl: HTMLElement,
    clientX: number,
    clientY: number
  ): { xPct: number; yPct: number } {
    const rect = pageEl.getBoundingClientRect();
    return {
      xPct: Math.min(92, Math.max(1, ((clientX - rect.left) / rect.width) * 100)),
      yPct: Math.min(96, Math.max(1, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
  }

  function applyInteract(clientX: number, clientY: number) {
    const session = interact.current;
    if (!session) return;
    const rect = session.pageEl.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dx = ((clientX - session.startX) / rect.width) * 100;
    const dy = ((clientY - session.startY) / rect.height) * 100;
    if (Math.abs(dx) > 0.12 || Math.abs(dy) > 0.12) skipClick.current = true;
    const { orig } = session;
    const next =
      session.mode === "move"
        ? {
            ...orig,
            xPct: clamp(orig.xPct + dx, 0.4, 97),
            yPct: clamp(orig.yPct + dy, 0.4, 97.5),
          }
        : {
            ...orig,
            wPct: clamp(
              orig.wPct + dx,
              orig.bind === "signature" ? 10 : 4,
              Math.max(10, 99 - orig.xPct)
            ),
            hPct: clamp(
              orig.hPct + dy,
              orig.bind === "signature" ? 1.3 : 1.1,
              Math.min(orig.bind === "signature" ? 8 : 4, 99 - orig.yPct)
            ),
          };
    onFieldsChange?.(fieldsRef.current.map((row) => (row.id === session.id ? next : row)));
  }

  function dropNew(bind: EsignBindKey, pageIndex: number, xPct: number, yPct: number) {
    const size = defaultSizeForBind(bind);
    const field: EsignLayoutField = {
      id: crypto.randomUUID(),
      bind,
      page: pageIndex,
      xPct,
      yPct,
      wPct: size.wPct,
      hPct: size.hPct,
    };
    onFieldsChange?.([...fields, field]);
    setActive(field);
  }

  return (
    <div className="space-y-4">
      {mode === "edit" ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="w-full text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Drag a field onto the page
          </p>
          {PALETTE.map((bind) => (
            <button
              key={bind}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/esign-bind", bind);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="rounded-full border border-[#161616]/20 bg-white px-3 py-1 text-xs font-medium text-[#161616]"
            >
              {BIND_LABELS[bind]}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {pages.length === 0 && !error ? (
        <p className="text-sm text-slate-500">Loading document…</p>
      ) : null}

      {pages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          onDragOver={(e) => {
            if (mode !== "edit") return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (mode !== "edit") return;
            e.preventDefault();
            const bind = e.dataTransfer.getData("text/esign-bind") as EsignBindKey;
            if (!bind) return;
            const { xPct, yPct } = pctOnPage(e.currentTarget, e.clientX, e.clientY);
            dropNew(bind, pageIndex, xPct, yPct);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={page.src} alt={`Page ${pageIndex + 1}`} className="block w-full" />
          {visibleFields(pageIndex).map((field) => {
            const isSig = field.bind === "signature";
            const isPlaced = isSig && placed.has(field.id);
            const isNext = Boolean(nextUnsigned && nextUnsigned.id === field.id);
            const boxClass = `h-full w-full overflow-hidden rounded border-2 p-0 text-left text-[10px] font-semibold leading-tight shadow-sm ${
              isSig
                ? isPlaced
                  ? "pointer-events-none cursor-default border-[#7A5620]/50 bg-white/80"
                  : "border-[#12B981] bg-[#A87830]/80 text-[#161616] ring-2 ring-[#A87830] ring-offset-1 animate-pulse"
                : "border-[#12B981] bg-[#A87830]/70 px-1 text-[#161616]"
            }`;
            const boxStyle = {
              left: `${field.xPct}%`,
              top: `${field.yPct}%`,
              width: `${field.wPct}%`,
              height: `${field.hPct}%`,
            };
            const inner = (
              <>
                {isSig ? (
                  isPlaced && signaturePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signaturePreview}
                      alt="Signature"
                      className="h-full w-full object-contain object-left"
                    />
                  ) : (
                    <span className="px-1">Tap to sign</span>
                  )
                ) : isAmountField(field.bind) ? (
                  formatUsd(values[field.bind] ?? "") || BIND_LABELS[field.bind]
                ) : (
                  values[field.bind]?.trim() || BIND_LABELS[field.bind]
                )}
              </>
            );
            if (isPlaced) {
              return (
                <div key={field.id} className="absolute" style={boxStyle}>
                  <div className={boxClass}>{inner}</div>
                </div>
              );
            }
            return (
              <div key={field.id} className="absolute" style={boxStyle}>
                <button
                  ref={isNext ? sigBtnRef : undefined}
                  type="button"
                  className={`${boxClass} ${mode === "edit" ? "cursor-move" : ""}`}
                  onPointerDown={(e) => {
                    if (mode !== "edit") return;
                    const pageEl = e.currentTarget.parentElement?.parentElement;
                    if (!pageEl) return;
                    interact.current = {
                      id: field.id,
                      mode: "move",
                      startX: e.clientX,
                      startY: e.clientY,
                      orig: field,
                      pageEl,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => applyInteract(e.clientX, e.clientY)}
                  onPointerUp={() => {
                    interact.current = null;
                  }}
                  onClick={() => {
                    if (skipClick.current) {
                      skipClick.current = false;
                      return;
                    }
                    if (readOnly) return;
                    if (clientSigner && isSig && signaturePreview) {
                      onSignature?.(signaturePreview, field.id);
                      return;
                    }
                    setActive(field);
                  }}
                >
                  {inner}
                </button>
                {mode === "edit" ? (
                  <span
                    role="presentation"
                    aria-hidden
                    title="Resize"
                    className="absolute bottom-0 right-0 z-10 h-3.5 w-3.5 translate-x-[30%] translate-y-[30%] cursor-nwse-resize rounded-[2px] border border-[#161616] bg-[#A87830] shadow-sm"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const pageEl = e.currentTarget.parentElement?.parentElement;
                      if (!pageEl) return;
                      interact.current = {
                        id: field.id,
                        mode: "resize",
                        startX: e.clientX,
                        startY: e.clientY,
                        orig: field,
                        pageEl,
                      };
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => applyInteract(e.clientX, e.clientY)}
                    onPointerUp={() => {
                      interact.current = null;
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ))}

      {active ? (
        <EsignFieldConfirmModal
          bind={active.bind}
          label={BIND_LABELS[active.bind]}
          value={
            active.bind === "signature"
              ? values.fullName || values.signature || ""
              : (values[active.bind] ?? "")
          }
          midOptions={midOptions}
          allowBindChange={mode === "edit"}
          intentCopy={clientSigner && active.bind === "signature" ? intentCopy : undefined}
          onIntentAccepted={onIntentAccepted}
          onCancel={() => setActive(null)}
          onRemove={
            mode === "edit"
              ? () => {
                  onFieldsChange?.(fields.filter((row) => row.id !== active.id));
                  setActive(null);
                }
              : undefined
          }
          onConfirm={(next, png, nextBind) => {
            if (mode === "edit") {
              const bind = nextBind ?? active.bind;
              onFieldsChange?.(
                fields.map((row) => (row.id === active.id ? { ...row, bind } : row))
              );
              setActive(null);
              return;
            }
            onValuesChange?.(active.bind, next);
            if (png) onSignature?.(png, active.id);
            setActive(null);
          }}
        />
      ) : null}
    </div>
  );
}
