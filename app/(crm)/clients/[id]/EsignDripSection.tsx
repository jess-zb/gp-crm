"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Info, Loader2, PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { EsignPrefillReviewModal } from "@/app/components/esign/EsignPrefillReviewModal";
import { isUploadableEsignKind, type EsignKind, type EsignRequestRow, type EsignStatus } from "@/lib/esign/types";
import type { EsignClientPrefill } from "@/lib/esign/map-client-prefill";

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  viewed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  signed: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  declined: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  revoked: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  failed: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  superseded: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function fmtWhen(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function latestForKind(rows: EsignRequestRow[], kind: EsignKind): EsignRequestRow | null {
  return rows.find((row) => row.kind === kind && row.status !== "superseded") ?? null;
}

const ESIGN_CARDS: { kind: EsignKind; title: string; hint: string }[] = [
  {
    kind: "cc_authorization",
    title: "CC Auth",
    hint: "Bank authorization form",
  },
  {
    kind: "welcome_packet",
    title: "Welcome Packet",
    hint: "Signed POA — queues print after the client signs",
  },
  {
    kind: "ac_cc_authorization",
    title: "Arlington Coaching CC Auth",
    hint: "One-time card charge",
  },
  {
    kind: "ac_welcome_packet",
    title: "AC Welcome Packet",
    hint: "Program agreement — one signature",
  },
];

export function EsignDripSection({
  clientId,
  clientFirstName = "",
  clientLastName = "",
  advisorName = "",
  canPlaceFields = false,
  canSend = true,
}: {
  clientId: string;
  clientFirstName?: string;
  clientLastName?: string;
  advisorName?: string;
  canPlaceFields?: boolean;
  canSend?: boolean;
}) {
  const toast = useToast();
  const [helpOpen, setHelpOpen] = useState(false);
  const [rows, setRows] = useState<EsignRequestRow[]>([]);
  const [busyKind, setBusyKind] = useState<EsignKind | null>(null);
  const [reviewKind, setReviewKind] = useState<EsignKind | null>(null);
  const [reviewPrefill, setReviewPrefill] = useState<EsignClientPrefill | null>(null);
  const [reviewMids, setReviewMids] = useState<string[]>([]);
  const [reviewAdvisors, setReviewAdvisors] = useState<string[]>([]);
  const [uploadingKind, setUploadingKind] = useState<EsignKind | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("esign_requests")
      .select(
        "id, client_id, kind, opensign_document_id, status, signer_email, signer_name, sent_by, sent_at, completed_at, signed_document_id, certificate_document_id, last_error"
      )
      .eq("client_id", clientId)
      .order("sent_at", { ascending: false })
      .limit(20);
    if (error) {
      console.error("[E-Sign] load", error.message);
      return;
    }
    setRows((data ?? []) as EsignRequestRow[]);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openReview(kind: EsignKind) {
    if (!canSend) {
      toast.error("E-Sign send is available in Account Manager or Client Services.");
      return;
    }
    setBusyKind(kind);
    try {
      const res = await fetch(`/api/esign/prefill?clientId=${encodeURIComponent(clientId)}&kind=${kind}`);
      const json = (await res.json()) as {
        error?: string;
        prefill?: EsignClientPrefill;
        midOptions?: string[];
        advisorOptions?: string[];
      };
      if (!res.ok || !json.prefill) {
        toast.error(toUserFacingError(json.error || "Could not load client details"));
        return;
      }
      const prefill = { ...json.prefill };
      prefill.firstName = String(prefill.firstName ?? "").trim() || clientFirstName.trim();
      prefill.lastName = String(prefill.lastName ?? "").trim() || clientLastName.trim();
      prefill.advisor = String(prefill.advisor ?? "").trim() || advisorName.trim();
      setReviewPrefill(prefill);
      setReviewMids(json.midOptions ?? []);
      const advisors = json.advisorOptions ?? [];
      if (prefill.advisor && !advisors.includes(prefill.advisor)) {
        advisors.unshift(prefill.advisor);
      }
      setReviewAdvisors(advisors);
      setReviewKind(kind);
    } catch (err) {
      toast.error(toUserFacingError(err instanceof Error ? err.message : "Could not load client details"));
    } finally {
      setBusyKind(null);
    }
  }

  async function uploadTemplate(kind: EsignKind, file: File) {
    if (!isUploadableEsignKind(kind)) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Upload a PDF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("PDF must be 8 MB or smaller.");
      return;
    }
    setUploadingKind(kind);
    try {
      const initRes = await fetch("/api/esign/template-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, fileName: file.name, fileSize: file.size }),
      });
      const initJson = (await initRes.json()) as { error?: string; path?: string; token?: string };
      if (!initRes.ok || !initJson.path || !initJson.token) {
        toast.error(toUserFacingError(initJson.error || "Could not start upload"));
        return;
      }
      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("esign-templates")
        .uploadToSignedUrl(initJson.path, initJson.token, file, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadErr) {
        toast.error(toUserFacingError(uploadErr.message || "Upload failed"));
        return;
      }
      const doneRes = await fetch("/api/esign/template-file/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, path: initJson.path, fileSize: file.size }),
      });
      const doneJson = (await doneRes.json()) as { error?: string };
      if (!doneRes.ok) {
        toast.error(toUserFacingError(doneJson.error || "Could not save the PDF"));
        return;
      }
      toast.success("PDF saved. New sends use this file.");
    } catch (err) {
      toast.error(toUserFacingError(err instanceof Error ? err.message : "Could not upload"));
    } finally {
      setUploadingKind(null);
    }
  }

  async function send(kind: EsignKind, prefill: Partial<EsignClientPrefill> & { fullName?: string }) {
    setBusyKind(kind);
    try {
      const res = await fetch("/api/esign/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, kind, prefill }),
      });
      const json = (await res.json()) as {
        error?: string;
        sentAt?: string;
        queuedFedex?: boolean;
      };
      if (!res.ok) {
        toast.error(toUserFacingError(json.error || "Could not send"));
        return;
      }
      toast.success(
        kind === "welcome_packet" && json.queuedFedex
          ? "Welcome Packet sent — also queued for FedEx"
          : "Sent to the client"
      );
      await load();
    } catch (err) {
      toast.error(toUserFacingError(err instanceof Error ? err.message : "Could not send"));
    } finally {
      setBusyKind(null);
      setReviewKind(null);
      setReviewPrefill(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
      <div className="mb-3 flex items-center gap-2">
        <PenLine className="h-3.5 w-3.5 text-[#8DE3B5]" aria-hidden />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          E-Sign
        </h3>
        <div className="relative">
          <button
            type="button"
            className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#102840] dark:hover:text-slate-200"
            aria-label="When E-Sign is available"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((open) => !open)}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {helpOpen ? (
            <div
              role="tooltip"
              className="absolute left-0 top-6 z-20 w-64 rounded-lg border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-600 shadow-lg dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-slate-300"
            >
              E-Sign is available when the client is in Account Manager or Client
              Services.
            </div>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ESIGN_CARDS.map((card) => (
          <EsignKindCard
            key={card.kind}
            title={card.title}
            hint={card.hint}
            row={latestForKind(rows, card.kind)}
            busy={busyKind === card.kind}
            disabled={busyKind !== null || !canSend}
            placeHref={canPlaceFields ? `/esign-templates/${card.kind}` : undefined}
            canUpload={isUploadableEsignKind(card.kind)}
            uploading={uploadingKind === card.kind}
            onUpload={(file) => void uploadTemplate(card.kind, file)}
            onSend={() => void openReview(card.kind)}
          />
        ))}
      </div>
      {reviewKind && reviewPrefill ? (
        <EsignPrefillReviewModal
          kind={reviewKind}
          prefill={reviewPrefill}
          midOptions={reviewMids}
          advisorOptions={reviewAdvisors}
          confirmLabel="Send document"
          submitting={busyKind === reviewKind}
          onCancel={() => {
            if (busyKind) return;
            setReviewKind(null);
            setReviewPrefill(null);
          }}
          onConfirm={(snapshot) => void send(reviewKind, snapshot)}
        />
      ) : null}
    </div>
  );
}

function EsignKindCard({
  title,
  hint,
  row,
  busy,
  disabled,
  placeHref,
  canUpload = false,
  uploading = false,
  onUpload,
  onSend,
}: {
  title: string;
  hint: string;
  row: EsignRequestRow | null;
  busy: boolean;
  disabled: boolean;
  placeHref?: string;
  canUpload?: boolean;
  uploading?: boolean;
  onUpload?: (file: File) => void;
  onSend: () => void;
}) {
  const status = row?.status as EsignStatus | undefined;
  const fileOnUploads = status === "completed" && Boolean(row?.signed_document_id);
  const sendLocked = disabled || fileOnUploads;
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : null;
  const when = row?.completed_at || row?.sent_at || null;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-[#1a3550] dark:bg-[#071929]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={sendLocked}
          title={fileOnUploads ? "Signed copy is on Uploads. Send is locked." : undefined}
          className="crm-btn-primary !px-3 !py-1.5 !text-xs"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : status === "completed" ? (
            "Done"
          ) : row ? (
            "Resend"
          ) : (
            "Send"
          )}
        </button>
      </div>
      {placeHref || canUpload ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {canUpload ? (
            <label
              className="cursor-pointer text-[11px] text-[#0A2540] underline dark:text-[#8DE3B5]"
              title="Replaces this form for every client. New sends use the uploaded PDF."
            >
              {uploading ? "Uploading…" : "Upload PDF"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={uploading || busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onUpload?.(file);
                }}
              />
            </label>
          ) : null}
          {placeHref ? (
            <Link
              href={placeHref}
              className="text-[11px] text-[#0A2540] underline dark:text-[#8DE3B5]"
            >
              Place fields
            </Link>
          ) : null}
        </div>
      ) : null}
      {row ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
              STATUS_STYLES[status ?? ""] ?? STATUS_STYLES.sent
            }`}
          >
            {label}
          </span>
          {when ? (
            <span className="text-slate-500 dark:text-slate-400">{fmtWhen(when)}</span>
          ) : null}
          {row.last_error ? (
            <p className="w-full text-red-500 dark:text-red-400">{row.last_error}</p>
          ) : status === "completed" && !row.signed_document_id ? (
            <p className="w-full text-amber-700 dark:text-amber-400">
              Signed copy is missing from Uploads.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">Not sent yet</p>
      )}
    </div>
  );
}
