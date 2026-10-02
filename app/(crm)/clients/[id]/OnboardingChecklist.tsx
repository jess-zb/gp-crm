"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadClientDocument } from "@/lib/clients/documents-upload-client";
import { emitClientProfilePatch } from "@/lib/clients/client-profile-patch";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import {
  CHECKLIST_COLLECTION_ITEM,
  CHECKLIST_ITEM_LABELS,
  CHECKLIST_POA_ITEM,
  CHECKLIST_WELCOME_PACKET_ITEM,
  findWelcomeChecklistRow,
} from "@/lib/clients/ensure-checklist";
import {
  type ChecklistAutoContext,
  getChecklistItemVisualState,
} from "@/lib/clients/checklist-auto-state";
import { canBypassChecklist } from "@/lib/roles";
import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";
import {
  normalizePipelineStage,
  pipelineStageAuditAction,
} from "@/lib/clients/pipeline-status";

type ChecklistRow = {
  id: string;
  item: string;
  completed: boolean;
  bypassed: boolean;
  bypass_reason: string | null;
};

type ClientFlags = {
  hasCard: boolean;
  hasPoaDocumentType: boolean;
  hasCollectionDoc: boolean;
  hasFedexShipment: boolean;
  poa_signed_at: string | null;
  cc_charged_at: string | null;
};

type DeliveryClient = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  delivery_method: string | null;
  resend_method: string | null;
  postlogic_status: string | null;
  postlogic_unique_id: string | null;
  fedex_batch_sent_at: string | null;
  fedex_queued_at: string | null;
  fedex_tracking_number: string | null;
  stage: string;
};

function findRow(rows: ChecklistRow[], label: string) {
  return rows.find((r) => r.item === label);
}

const AUTO_CHECK_TOOLTIP = "Auto-verified based on client data";

function statusPill(
  state: ReturnType<typeof getChecklistItemVisualState>
): { text: string; className: string } {
  if (state.bypassed) {
    return {
      text: "Bypassed",
      className:
        "bg-yellow-100 text-yellow-950 ring-yellow-600/25 dark:bg-yellow-950/45 dark:text-yellow-100 dark:ring-yellow-500/35",
    };
  }
  if (state.autoChecked) {
    return {
      text: "Auto",
      className:
        "bg-emerald-50 text-emerald-700 ring-emerald-500/15 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-500/25",
    };
  }
  if (state.complete) {
    return {
      text: "Complete",
      className:
        "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-200",
    };
  }
  return {
    text: "Incomplete",
    className:
      "bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-950/50 dark:text-red-200",
  };
}

export function OnboardingChecklist({
  clientId,
  checklistRows,
  userRole,
  client,
  flags,
  variant = "default",
}: {
  clientId: string;
  checklistRows: ChecklistRow[];
  userRole: string;
  client: DeliveryClient;
  flags: ClientFlags;
  /** `sidebar`: compact table for narrow column; `account`: full-width Account tab */
  variant?: "default" | "sidebar" | "account";
}) {
  const isSidebar = variant === "sidebar";
  const isAccount = variant === "account";
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showProceedModal, setShowProceedModal] = useState(false);
  const [showPoaResendModal, setShowPoaResendModal] = useState(false);
  const [bypassOpen, setBypassOpen] = useState<{ id: string; label: string } | null>(
    null
  );
  const [bypassReason, setBypassReason] = useState("");

  const canBypass = canBypassChecklist(userRole);

  const filteredChecklistRows = useMemo(
    () =>
      checklistRows.filter((row) => !row.item.toLowerCase().includes("portal")),
    [checklistRows]
  );

  const rowsByLabel = useMemo(() => {
    const m = new Map<string, ChecklistRow>();
    for (const r of filteredChecklistRows) {
      m.set(r.item, r);
    }
    return m;
  }, [filteredChecklistRows]);

  const orderedRows = useMemo(() => {
    return CHECKLIST_ITEM_LABELS.map((label) => ({
      label,
      row:
        rowsByLabel.get(label) ??
        (label === CHECKLIST_WELCOME_PACKET_ITEM
          ? findWelcomeChecklistRow(filteredChecklistRows)
          : undefined),
    }));
  }, [rowsByLabel, filteredChecklistRows]);

  const autoContext = useMemo<ChecklistAutoContext>(
    () => ({
      stage: client.stage,
      hasCard: flags.hasCard,
      cc_charged_at: flags.cc_charged_at,
      hasPoaDocument: flags.hasPoaDocumentType,
      poa_signed_at: flags.poa_signed_at,
      hasCollectionDoc: flags.hasCollectionDoc,
      hasFedexShipment: flags.hasFedexShipment,
      fedex_queued_at: client.fedex_queued_at,
    }),
    [client.stage, client.fedex_queued_at, flags]
  );

  const itemStates = useMemo(() => {
    const states: Record<string, ReturnType<typeof getChecklistItemVisualState>> = {};
    for (const { label, row } of orderedRows) {
      states[label] = getChecklistItemVisualState(label, row, autoContext);
    }
    return states;
  }, [orderedRows, autoContext]);

  const markChecklistComplete = useCallback(
    async (itemLabel: string): Promise<boolean> => {
      const row =
        findRow(filteredChecklistRows, itemLabel) ??
        (itemLabel === CHECKLIST_WELCOME_PACKET_ITEM
          ? findWelcomeChecklistRow(filteredChecklistRows)
          : undefined);
      if (!row?.id) {
        toast.error("Checklist row missing. Save the client or contact admin.");
        return false;
      }
      setBusy(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not signed in.");
        setBusy(false);
        return false;
      }
      const { error } = await supabase
        .from("onboarding_checklist")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user.id,
        })
        .eq("id", row.id)
        .eq("client_id", clientId);
      setBusy(false);
      if (error) {
        toast.error(toUserFacingError(error.message));
        return false;
      }
      toast.success("Checklist updated");
      router.refresh();
      return true;
    },
    [filteredChecklistRows, clientId, router, toast]
  );

  const handleProceedToWelcomePacket = useCallback(async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not signed in.");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const performerName = prof?.full_name?.trim() || "Staff";
      const now = new Date().toISOString();
      const oldS = normalizePipelineStage(client.stage);

      const { error } = await supabase
        .from("clients")
        .update({
          stage: "welcome_packet",
          delivery_method: "fedex",
          fedex_queued_at: now,
          stage_entered_at: now,
        })
        .eq("id", clientId);

      if (error) throw error;

      const auditAction = pipelineStageAuditAction(oldS, "welcome_packet");
      const { error: auditErr } = await supabase.from("audit_log").insert({
        client_id: clientId,
        action: auditAction,
        old_value: { stage: oldS },
        new_value: {
          stage: "welcome_packet",
          delivery_method: "fedex",
          fedex_queued_at: now,
        },
        performed_by: user.id,
        performed_by_name: performerName,
      });
      if (auditErr) {
        console.warn("audit_log proceed welcome packet:", auditErr.message);
      }

      toast.success("Client advanced to Account Manager");
      setShowProceedModal(false);
      router.refresh();
    } catch {
      toast.error("Failed to advance client");
    } finally {
      setBusy(false);
    }
  }, [client.stage, clientId, router, toast]);

  const submitBypass = useCallback(async () => {
    if (!bypassOpen) return;
    const reason = bypassReason.trim();
    if (!reason) {
      toast.error("Reason is required.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("onboarding_checklist")
      .update({
        bypassed: true,
        bypass_reason: reason,
        completed: false,
      })
      .eq("id", bypassOpen.id)
      .eq("client_id", clientId);
    setBusy(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    toast.success("Item bypassed");
    setBypassOpen(null);
    setBypassReason("");
    router.refresh();
  }, [bypassOpen, bypassReason, clientId, router, toast]);

  const uploadPdf = useCallback(
    async (file: File, documentType: "poa_document" | "collection_letter") => {
      setBusy(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not signed in.");
        setBusy(false);
        return;
      }
      const runUpload = async (dt: string) => {
        const fd = new FormData();
        fd.append("clientId", clientId);
        fd.append("documentType", dt);
        fd.append("file", file);
        return uploadClientDocument(fd);
      };
      try {
        let stageAdvanceToast: string | undefined;
        if (documentType === "poa_document") {
          try {
            const r = await runUpload("poa_document");
            stageAdvanceToast = r.successMessage;
            if (r.clientPatch) {
              emitClientProfilePatch({ clientId, ...r.clientPatch });
            }
          } catch {
            const r = await runUpload("poa_signed");
            stageAdvanceToast = r.successMessage;
            if (r.clientPatch) {
              emitClientProfilePatch({ clientId, ...r.clientPatch });
            }
          }
          await markChecklistComplete(CHECKLIST_POA_ITEM);
        } else {
          const r = await runUpload("collection_letter");
          stageAdvanceToast = r.successMessage;
          await markChecklistComplete(CHECKLIST_COLLECTION_ITEM);
          router.refresh();
        }
        toast.success(stageAdvanceToast ?? "Uploaded");
      } catch (e) {
        toast.error(
          toUserFacingError(e instanceof Error ? e.message : "Upload failed")
        );
      } finally {
        setBusy(false);
      }
    },
    [clientId, markChecklistComplete, router, toast]
  );

  const btnPrimary = isSidebar
    ? "inline-flex min-h-11 min-w-[44px] items-center justify-center rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-semibold leading-tight text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-slate-200"
    : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-slate-200";

  const btnBypass = isSidebar
    ? "inline-flex min-h-11 min-w-[44px] items-center justify-center rounded border border-amber-300 bg-amber-50 px-1.5 py-1 text-[9px] font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    : "rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";

  const btnOutline = isSidebar
    ? "inline-flex min-h-11 min-w-[44px] items-center justify-center rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px] font-semibold text-slate-800 hover:bg-slate-50 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-slate-200"
    : "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-slate-200";

  const uploadLabel = "Upload";

  const proceedOutlineBtn =
    "text-xs px-2 py-1 rounded border border-[#8DE3B5] text-[#8DE3B5] hover:bg-green-50 transition-colors dark:hover:bg-emerald-950/40";

  const thClass = isSidebar
    ? "px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
    : "px-4 py-3 font-semibold text-slate-700 dark:text-slate-200";

  const tdTask = isSidebar
    ? "min-w-[160px] max-w-[min(100%,22rem)] w-[48%] max-md:whitespace-normal max-md:break-words px-2 py-1 text-[11px] font-medium text-slate-900 dark:text-slate-100 md:truncate"
    : "max-md:min-w-0 max-md:break-words max-md:whitespace-normal px-4 py-3 font-medium text-slate-900 dark:text-slate-100";

  const tdStatus = isSidebar
    ? "hidden w-[24%] whitespace-nowrap px-2 py-1 align-middle md:table-cell"
    : "hidden px-4 py-3 md:table-cell";

  const tdAction = isSidebar
    ? "w-[34%] px-2 py-1 text-right align-middle"
    : "px-4 py-3 text-right";

  const trClass = isSidebar
    ? "h-9 border-b border-slate-100 last:border-0 dark:border-[#1a3550]"
    : "border-b border-slate-100 last:border-0 dark:border-[#1a3550]";

  const pillClass = (base: string) =>
    isSidebar
      ? `inline-flex rounded-full px-1.5 py-0 text-[10px] font-semibold ring-1 ring-inset ${base}`
      : `inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${base}`;

  return (
    <section className="min-w-0 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
      {!isAccount ? (
        <div
          className={
            isSidebar
              ? "border-b border-slate-200 px-3 py-2 dark:border-[#1a3550]"
              : "border-b border-slate-200 px-4 py-3 dark:border-[#1a3550]"
          }
        >
          <h2
            className={
              isSidebar
                ? "text-sm font-bold text-slate-900 dark:text-white"
                : "text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200"
            }
          >
            {isSidebar ? "Checklist" : "Onboarding checklist"}
          </h2>
        </div>
      ) : null}
      <table
        className={`text-left ${
          isSidebar
            ? "w-full border-collapse table-fixed text-xs max-md:block max-md:w-full md:table"
            : isAccount
              ? "w-full table-fixed text-sm"
              : "w-full border-collapse text-sm"
        }`}
      >
        <thead
          className={isSidebar ? "max-md:hidden md:table-header-group" : undefined}
        >
          <tr
            className={
              isSidebar
                ? "border-b border-slate-200 bg-slate-50/90 dark:border-[#1a3550] dark:bg-[#0d2035]/80"
                : "border-b border-slate-200 bg-slate-50 dark:border-[#1a3550] dark:bg-[#0d2035]/80"
            }
          >
            <th
              className={
                isAccount ? "py-3 px-3 text-left w-[35%]" : `${thClass}`
              }
            >
              {isSidebar ? (
                "Task"
              ) : isAccount ? (
                "Task"
              ) : (
                <>
                  <span className="md:hidden">Task</span>
                  <span className="hidden md:inline">Item</span>
                </>
              )}
            </th>
            <th
              className={
                isAccount
                  ? "py-3 px-3 text-center w-[25%] hidden md:table-cell"
                  : `${thClass} hidden md:table-cell`
              }
            >
              Status
            </th>
            <th
              className={
                isAccount ? "py-3 px-3 text-right w-[40%]" : `${thClass} text-right`
              }
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody
          className={
            isSidebar
              ? "md:table-row-group max-md:grid max-md:grid-cols-2 max-md:gap-2 max-md:p-2"
              : undefined
          }
        >
          {orderedRows.map(({ label, row }) => {
            const state = itemStates[label] ?? getChecklistItemVisualState(label, row, autoContext);
            const { complete, autoChecked, manualChecked, bypassed } = state;
            const pill = statusPill(state);
            const rowId = row?.id;

            const accountTrClass = bypassed
              ? "border-b border-slate-200 bg-yellow-50 hover:bg-yellow-100/90 dark:border-[#1a3550] dark:bg-yellow-950/25 dark:hover:bg-yellow-950/40"
              : complete
                ? "border-b border-slate-200 bg-green-50 hover:bg-green-100/85 dark:border-[#1a3550] dark:bg-emerald-950/25 dark:hover:bg-emerald-950/35"
                : "border-b border-slate-200 bg-white hover:bg-slate-50 dark:border-[#1a3550] dark:bg-[#0d2035] dark:hover:bg-[#102840]";

            return (
              <tr
                key={label}
                className={
                  isAccount
                    ? accountTrClass
                    : `${trClass} ${isSidebar ? "md:table-row max-md:block max-md:rounded-lg max-md:border max-md:border-slate-200 max-md:p-2 dark:max-md:border-[#1a3550]" : ""}`
                }
              >
                <td
                  className={
                    isAccount
                      ? "py-3 px-3 text-left w-[35%]"
                      : `${tdTask} ${isSidebar ? "max-md:block max-md:w-full max-md:px-0 max-md:py-0.5 md:table-cell" : ""}`
                  }
                  title={label}
                >
                  {label}
                </td>
                <td
                  className={
                    isAccount
                      ? "py-3 px-3 text-center w-[25%] hidden md:table-cell"
                      : `${tdStatus} ${isSidebar ? "max-md:block max-md:w-full max-md:px-0 max-md:py-0.5 md:table-cell" : ""}`
                  }
                >
                  <span className={pillClass(pill.className)}>{pill.text}</span>
                </td>
                <td
                  className={
                    isAccount
                      ? "py-3 px-3 text-right w-[40%]"
                      : `${tdAction} ${isSidebar ? "max-md:block max-md:w-full max-md:px-0 max-md:py-0.5 md:table-cell" : ""}`
                  }
                >
                  {bypassed ? (
                    <span className="text-[10px] text-slate-400">—</span>
                  ) : (
                    <div
                      className={
                        isSidebar
                          ? "flex flex-wrap items-center justify-end gap-1"
                          : "flex flex-wrap items-center justify-end gap-2"
                      }
                    >
                      {complete ? (
                        <span
                            className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            title={autoChecked && !manualChecked ? AUTO_CHECK_TOOLTIP : "Complete"}
                          >
                            ✓
                          </span>
                      ) : null}

                      {!complete && label === CHECKLIST_WELCOME_PACKET_ITEM ? (
                        <button
                          type="button"
                          onClick={() => setShowProceedModal(true)}
                          className={proceedOutlineBtn}
                        >
                          Proceed?
                        </button>
                      ) : null}

                      {!complete && label === CHECKLIST_POA_ITEM ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setShowPoaResendModal(true)}
                            className={proceedOutlineBtn}
                          >
                            Resend
                          </button>
                          <label className={`inline-flex cursor-pointer ${btnPrimary}`}>
                            {uploadLabel}
                            <input
                              type="file"
                              accept="*/*"
                              className="hidden"
                              disabled={busy}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (f) void uploadPdf(f, "poa_document");
                              }}
                            />
                          </label>
                        </>
                      ) : null}

                      {!complete && label === CHECKLIST_COLLECTION_ITEM ? (
                        <label className={`inline-flex cursor-pointer ${btnPrimary}`}>
                          {uploadLabel}
                          <input
                            type="file"
                            accept="*/*"
                            className="hidden"
                            disabled={busy}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (f) void uploadPdf(f, "collection_letter");
                            }}
                          />
                        </label>
                      ) : null}

                      {canBypass && rowId && !complete ? (
                        <button
                          type="button"
                          onClick={() => setBypassOpen({ id: rowId, label })}
                          className={btnBypass}
                        >
                          Bypass
                        </button>
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showPoaResendModal ? (
        <WelcomePacketModal
          clientId={clientId}
          client={client}
          busy={busy}
          setBusy={setBusy}
          onClose={() => setShowPoaResendModal(false)}
          onRefresh={() => router.refresh()}
          markComplete={async () => {
            await markChecklistComplete(CHECKLIST_WELCOME_PACKET_ITEM);
          }}
        />
      ) : null}

      {showProceedModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="crm-modal-panel mx-4 max-w-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-950/50">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  Skip ahead to Account Manager?
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                  Some steps may not be complete
                </p>
              </div>
            </div>

            <p className="mb-5 text-sm text-gray-600 dark:text-slate-300">
              Do you still want to proceed to the Account Manager stage? This will advance the client
              and queue their packet for delivery.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowProceedModal(false)}
                className="crm-btn-secondary flex-1"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleProceedToWelcomePacket()}
                className="crm-btn-primary flex-1 inline-flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  "Yes, Proceed"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bypassOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">
              Bypass: {bypassOpen.label}
            </h4>
            <label className="mt-4 block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Reason <span className="text-red-600">*</span>
              </span>
              <textarea
                value={bypassReason}
                onChange={(e) => setBypassReason(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-[#1a3550] dark:bg-[#071929] dark:text-white"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setBypassOpen(null);
                  setBypassReason("");
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-[#1a3550] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitBypass()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Confirm bypass
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WelcomePacketModal({
  clientId,
  client,
  busy,
  setBusy,
  onClose,
  onRefresh,
  markComplete,
}: {
  clientId: string;
  client: DeliveryClient;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onClose: () => void;
  onRefresh: () => void;
  markComplete: () => Promise<void>;
}) {
  const toast = useToast();
  const router = useRouter();
  const [sendingFedEx, setSendingFedEx] = useState(false);

  const handleSendFedEx = async () => {
    setSendingFedEx(true);
    try {
      const supabase = createClient();
      const isResend = !!client.fedex_queued_at;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not signed in.");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const performerName = prof?.full_name?.trim() || "Staff";

      const queuedAt = new Date().toISOString();
      const { error } = await supabase
        .from("clients")
        .update({
          delivery_method: "fedex",
          fedex_queued_at: queuedAt,
        })
        .eq("id", clientId);

      if (error) throw error;

      const { error: auditErr } = await supabase.from("audit_log").insert({
        client_id: clientId,
        action: isResend ? "welcome_packet_resent" : "welcome_packet_queued",
        new_value: {
          delivery_method: "fedex",
          queued_at: queuedAt,
        },
        performed_by: user.id,
        performed_by_name: performerName,
      });
      if (auditErr) {
        console.warn("audit_log welcome packet:", auditErr.message);
      }

      toast.success("Queued for next FedEx batch");
      onRefresh();
    } catch {
      toast.error("Failed to queue FedEx");
    } finally {
      setSendingFedEx(false);
    }
  };

  const hasBatchSent =
    client.fedex_batch_sent_at != null &&
    !Number.isNaN(new Date(client.fedex_batch_sent_at).getTime());
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-lg font-bold text-slate-900 dark:text-white">
          Account Manager
        </h4>

        <div className="mt-4 space-y-4 text-sm text-gray-600 dark:text-slate-300">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-slate-800/60">
            <p className="mb-1 font-medium text-gray-900 dark:text-slate-100">
              Selected method:{" "}
              <span className="ml-1 capitalize text-[#8DE3B5]">
                {client.delivery_method === "docusign"
                  ? "Not set"
                  : client.delivery_method?.replace(/_/g, " ") || "Not set"}
              </span>
            </p>
            {hasBatchSent ? (
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Batch sent: <ClientFormattedDate iso={client.fedex_batch_sent_at} />
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 p-4 dark:border-[#1a3550]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">📦 Via FedEx</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                  Physical packet shipped to client address
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSendFedEx()}
                disabled={sendingFedEx}
                className="crm-btn-primary !px-3 !py-1.5 !text-xs"
              >
                {sendingFedEx ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Queuing…
                  </>
                ) : (
                  "Send via FedEx"
                )}
              </button>
            </div>
            {client.fedex_queued_at ? (
              <p className="mt-2 text-xs text-green-600 dark:text-emerald-400">
                ✓ {client.resend_method === "fedex" ? "Resent" : "Queued"}:{" "}
                <ClientFormattedDate iso={client.fedex_queued_at} pattern="MM/dd/yy h:mm a" />
              </p>
            ) : null}
          </div>

          <div className="border-t border-slate-200 pt-2 dark:border-[#1a3550]">
            <p className="text-center text-xs text-gray-500 dark:text-slate-400">
              Need to resend? Use button above to queue a new send.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-[#1a3550] dark:text-slate-200"
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy || sendingFedEx}
            onClick={() => void markComplete()}
            className="rounded-lg bg-[#8DE3B5] px-4 py-2 text-sm font-bold text-[#0A2540] disabled:opacity-50"
          >
            Mark complete
          </button>
        </div>
      </div>
    </div>
  );
}
