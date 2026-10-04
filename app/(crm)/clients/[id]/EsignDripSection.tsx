"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseLayoutFields } from "@/lib/esign/layout";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { EsignPrefillReviewModal } from "@/app/components/esign/EsignPrefillReviewModal";
import {
  ESIGN_REQUEST_SELECT,
  type EsignRequestRow,
  type EsignStatus,
  type EsignTemplateCard,
} from "@/lib/esign/types";
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

function latestForTemplate(rows: EsignRequestRow[], templateId: string): EsignRequestRow | null {
  return rows.find((row) => row.template_id === templateId && row.status !== "superseded") ?? null;
}

type ReviewTarget = {
  templateId: string;
  fields: unknown;
  requiredBinds: string[];
};

export function EsignDripSection({
  clientId,
  clientFirstName = "",
  clientLastName = "",
  advisorName = "",
  canSend = true,
  onHide,
}: {
  clientId: string;
  clientFirstName?: string;
  clientLastName?: string;
  advisorName?: string;
  canSend?: boolean;
  onHide?: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [rows, setRows] = useState<EsignRequestRow[]>([]);
  const [templates, setTemplates] = useState<EsignTemplateCard[] | null>(null);
  const [midName, setMidName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewTarget | null>(null);
  const [reviewPrefill, setReviewPrefill] = useState<EsignClientPrefill | null>(null);
  const [reviewAdvisors, setReviewAdvisors] = useState<string[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [requests, templateRes] = await Promise.all([
      supabase
        .from("esign_requests")
        .select(ESIGN_REQUEST_SELECT)
        .eq("client_id", clientId)
        .order("sent_at", { ascending: false })
        .limit(40),
      fetch(`/api/esign/templates?clientId=${encodeURIComponent(clientId)}`),
    ]);

    if (requests.error) {
      console.error("[E-Sign] load", requests.error.message);
      setLoadError("Could not load e-sign history.");
    } else {
      setRows((requests.data ?? []) as EsignRequestRow[]);
    }

    const json = (await templateRes.json().catch(() => null)) as {
      error?: string;
      midId?: string | null;
      midName?: string | null;
      templates?: EsignTemplateCard[];
    } | null;
    if (!templateRes.ok || !json?.templates) {
      setLoadError(toUserFacingError(json?.error || "Could not load this MID's documents."));
      setTemplates([]);
      return;
    }
    setLoadError("");
    setMidName(json.midName ?? null);
    setTemplates(json.templates);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openReview(templateId: string) {
    if (!canSend) {
      toast.error("E-Sign send is available in Account Manager or Client Services.");
      return;
    }
    setBusyId(templateId);
    try {
      const res = await fetch(
        `/api/esign/prefill?clientId=${encodeURIComponent(clientId)}&templateId=${encodeURIComponent(templateId)}`
      );
      const json = (await res.json()) as {
        error?: string;
        prefill?: EsignClientPrefill;
        advisorOptions?: string[];
        fields?: unknown;
        requiredBinds?: string[];
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
      const advisors = json.advisorOptions ?? [];
      if (prefill.advisor && !advisors.includes(prefill.advisor)) {
        advisors.unshift(prefill.advisor);
      }
      setReviewAdvisors(advisors);
      setReview({
        templateId,
        fields: json.fields ?? [],
        requiredBinds: json.requiredBinds ?? [],
      });
    } catch (err) {
      toast.error(toUserFacingError(err instanceof Error ? err.message : "Could not load client details"));
    } finally {
      setBusyId(null);
    }
  }

  async function send(
    templateId: string,
    prefill: Partial<EsignClientPrefill> & { fullName?: string }
  ) {
    setBusyId(templateId);
    try {
      const res = await fetch("/api/esign/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, templateId, prefill }),
      });
      const json = (await res.json()) as { error?: string; signUrl?: string; emailed?: boolean };
      if (!res.ok) {
        toast.error(toUserFacingError(json.error || "Could not send"));
        return;
      }
      if (json.signUrl && json.emailed === false) {
        toast.success("Signing link is ready. Email is not configured on this machine.");
        window.open(json.signUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.success("Sent to the client");
      }
      await load();
    } catch (err) {
      toast.error(toUserFacingError(err instanceof Error ? err.message : "Could not send"));
    } finally {
      setBusyId(null);
      setReview(null);
      setReviewPrefill(null);
    }
  }

  const midLabel = midName?.trim() || "this MID";

  return (
    <div
      id="esign"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
    >
      <div className="mb-3 flex items-center gap-2">
        <PenLine className="h-3.5 w-3.5 text-[#A87830]" aria-hidden />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          E-Sign
        </h3>
        <div className="relative">
          <button
            type="button"
            className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#242424] dark:hover:text-slate-200"
            aria-label="When E-Sign is available"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((open) => !open)}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {helpOpen ? (
            <div
              role="tooltip"
              className="absolute left-0 top-6 z-20 w-64 rounded-lg border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-600 shadow-lg dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-300"
            >
              E-Sign is available when the client is in Account Manager or Client
              Services. Only documents owned by {midLabel} are listed.
            </div>
          ) : null}
        </div>
        {onHide ? (
          <button
            type="button"
            onClick={onHide}
            className="ml-auto rounded-md px-1.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:text-slate-400 dark:hover:bg-[#242424] dark:hover:text-slate-100"
          >
            Hide
          </button>
        ) : null}
      </div>

      {templates === null ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading documents…
        </p>
      ) : loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : !midName ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This client has no MID, so there are no documents to send. Choose one above.
        </p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {midLabel} has no e-sign documents yet. Add them from E-Sign Documents in the sidebar.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((card) => (
            <EsignTemplateSendCard
              key={card.id}
              title={card.name}
              hint={
                card.hint?.trim() ||
                (card.behavior === "welcome_packet"
                  ? "Signed POA — advances the client once signed"
                  : "Sends this MID's document")
              }
              row={latestForTemplate(rows, card.id)}
              busy={busyId === card.id}
              disabled={busyId !== null || !canSend}
              onSend={() => void openReview(card.id)}
            />
          ))}
        </div>
      )}

      {review && reviewPrefill ? (
        <EsignPrefillReviewModal
          template={{ fields: review.fields, required_binds: review.requiredBinds }}
          prefill={reviewPrefill}
          midOptions={reviewPrefill.mid ? [reviewPrefill.mid] : []}
          advisorOptions={reviewAdvisors}
          confirmLabel="Send document"
          preview={{
            clientId,
            templateId: review.templateId,
            fields: parseLayoutFields(review.fields) ?? [],
          }}
          submitting={busyId === review.templateId}
          onCancel={() => {
            if (busyId) return;
            setReview(null);
            setReviewPrefill(null);
          }}
          onConfirm={(snapshot) => void send(review.templateId, snapshot)}
        />
      ) : null}
    </div>
  );
}

function EsignTemplateSendCard({
  title,
  hint,
  row,
  busy,
  disabled,
  onSend,
}: {
  title: string;
  hint: string;
  row: EsignRequestRow | null;
  busy: boolean;
  disabled: boolean;
  onSend: () => void;
}) {
  const status = row?.status as EsignStatus | undefined;
  const fileOnUploads = status === "completed" && Boolean(row?.signed_document_id);
  const sendLocked = disabled || fileOnUploads;
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : null;
  const when = row?.completed_at || row?.sent_at || null;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-[#2E2E2E] dark:bg-[#121212]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={sendLocked}
          title={fileOnUploads ? "Signed copy is filed. Send is locked." : undefined}
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
              Signed copy is missing from Documents.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">Not sent yet</p>
      )}
    </div>
  );
}
