"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  PenLine,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { ModalOverlay } from "@/app/components/ModalOverlay";
import { toUserFacingError } from "@/lib/user-facing-error";
import {
  canCancelClientToDnc,
  canUseStageDropdown,
} from "@/lib/roles";
import {
  isForwardPipelineTransition,
  normalizePipelineStage,
  pipelineStageAuditAction,
  wouldSkipPipelineStages,
} from "@/lib/clients/pipeline-status";
import { STAGE_LABELS } from "@/lib/constants/stages";
import { StagePill } from "@/app/components/StagePill";
import { handleStageTransition, rowFromTemplate } from "@/lib/reminders/workflow";
import {
  cancelActiveSequenceEnrollmentsServerAction,
  runStageEntrySideEffectsServerAction,
} from "./stage-entry-actions";
import { buildSearchQuery } from "@/lib/clients/client-search";
import {
  blockAdvanceFromAccountManagerWithoutSignedWelcomePacket,
  blockAdvanceFromClientServicesWithoutPoa,
  WELCOME_PACKET_GATE_TITLE,
} from "@/lib/workflow/stage-blockers";
import {
  getStageDropdownOptionLabel,
  getStageDropdownOptions,
} from "@/lib/clients/stage-dropdown-options";
import { AssignmentModal, type AssignmentDepartment } from "./AssignmentModal";
import { formatMoneyUsdFromCents } from "@/lib/utils/format";
import { useMidNames } from "@/lib/hooks/use-mids";
import {
  parseRefundAmountCents,
  type RefundPrefill,
} from "@/lib/refunds/prefill";
import {
  CANCEL_REASONS,
  getCancelReasonLabel,
  resolveClientCancelUpdate,
  type CancelReasonValue,
} from "@/lib/clients/cancel-reasons";
import { subscribeClientProfilePatch } from "@/lib/clients/client-profile-patch";

const STAGE_DISPLAY = STAGE_LABELS;

/** Advance / Go Back skip `retention` and `dnc` (use Cancel modal for those). */
const NAVIGATION_STAGE_ORDER = [
  "lead",
  "account_manager",
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
  "closed",
] as const;

function getNextStage(current: string | null): string | null {
  const s = normalizePipelineStage(current);
  if (s === "retention") return "client_services";
  if (s === "dnc") return "closed";
  const idx = (NAVIGATION_STAGE_ORDER as readonly string[]).indexOf(s);
  if (idx === -1 || idx === NAVIGATION_STAGE_ORDER.length - 1) return null;
  return NAVIGATION_STAGE_ORDER[idx + 1]!;
}

/** Stages whose auto-appointments come from `runStageEntrySideEffects`, not reminder_templates. */
const STAGES_WITH_ENTRY_SIDE_EFFECTS = new Set([
  "client_services",
  "retention",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
]);

function getPrevStage(current: string | null): string | null {
  const s = normalizePipelineStage(current);
  if (s === "retention") return "account_manager";
  if (s === "dnc") return "case_sent_to_attorneys";
  const idx = (NAVIGATION_STAGE_ORDER as readonly string[]).indexOf(s);
  if (idx <= 0) return null;
  return NAVIGATION_STAGE_ORDER[idx - 1]!;
}

/** Remaining templates (Phase 2): all disabled. Re-enable a row with is_active = true. */
async function createAutoReminders(
  supabase: ReturnType<typeof createClient>,
  toast: { success: (message: string) => void },
  clientId: string,
  newStage: string,
  assignedTo: string | null
) {
  const { data: templates } = await supabase
    .from("reminder_templates")
    .select("id, stage, title, description, hours_after_stage_entry")
    .eq("stage", newStage)
    .eq("is_active", true);

  if (!templates?.length) return;

  const reminders = templates.map((template) => {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + Number(template.hours_after_stage_entry));
    const title = typeof template.title === "string" ? template.title.trim() : "";
    const desc =
      typeof template.description === "string" ? template.description.trim() : "";

    return rowFromTemplate({
      clientId,
      assignedTo,
      templateId: template.id as string,
      templateStage: (template.stage as string) ?? newStage,
      title,
      descriptionFallback: desc,
      dueIso: dueDate.toISOString(),
    });
  });

  const { error } = await supabase.from("reminders").insert(reminders);

  if (error) {
    console.error("Auto reminder creation failed:", error);
  } else {
    toast.success(
      `${reminders.length} appointment${reminders.length === 1 ? "" : "s"} created automatically`
    );
  }
}

type AssignmentFlowState = {
  title: string;
  department: AssignmentDepartment;
  pendingStage: string;
  applyOpts?: {
  };
};

export function ClientStageHeader({
  displayName,
  clientId,
  stage: stageFromServer,
  performerId,
  performerName,
  userRole,
  assignedTo,
  assignedUserName: _assignedUserName,
  assignedServicesId,
  accountsUser,
  servicesUser,
  shouldPromptSelfAssign,
  viewerDept,
  poaSignedAt: poaSignedAtFromServer,
  hasPoaDocument: hasPoaDocumentFromServer,
  refundPrefill,
}: {
  displayName: string;
  clientId: string;
  stage: string | null;
  performerId: string;
  performerName: string;
  userRole: string;
  assignedTo: string | null;
  assignedUserName?: string | null;
  assignedServicesId: string | null;
  accountsUser: { full_name: string | null } | null;
  servicesUser: { full_name: string | null } | null;
  shouldPromptSelfAssign: boolean;
  viewerDept: { is_accounts: boolean; is_services: boolean };
  /** Used to gate advance client_services → awaiting_collection_letter */
  poaSignedAt?: string | null;
  /** POA document already on file (Uploads tab) */
  hasPoaDocument?: boolean;
  /** Starting values for the Refund Requested fields, derived from the client's cards. */
  refundPrefill?: RefundPrefill;
}) {
  const router = useRouter();
  const toast = useToast();
  const merchantOptions = useMidNames();
  const [stage, setStage] = useState(stageFromServer);
  const [poaSignedAt, setPoaSignedAt] = useState(poaSignedAtFromServer);
  const [hasPoaDocument, setHasPoaDocument] = useState(hasPoaDocumentFromServer);

  useEffect(() => {
    setStage(stageFromServer);
    setPoaSignedAt(poaSignedAtFromServer);
    setHasPoaDocument(hasPoaDocumentFromServer);
  }, [stageFromServer, poaSignedAtFromServer, hasPoaDocumentFromServer]);

  useEffect(() => {
    return subscribeClientProfilePatch(clientId, (patch) => {
      if (patch.stage !== undefined) setStage(patch.stage);
      if (patch.poaSignedAt !== undefined) setPoaSignedAt(patch.poaSignedAt);
      if (patch.hasPoaDocument !== undefined) setHasPoaDocument(patch.hasPoaDocument);
    });
  }, [clientId]);
  const suppressDropdownRevert = useRef(false);
  const [loading, setLoading] = useState<"advance" | "back" | null>(null);
  const [welcomePacketGate, setWelcomePacketGate] = useState<string | null>(null);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [cancelReasonBackToConfirm, setCancelReasonBackToConfirm] =
    useState(false);
  const [selectedCancelReason, setSelectedCancelReason] =
    useState<CancelReasonValue | null>(null);
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [refundAmount, setRefundAmount] = useState(
    refundPrefill?.amountCents ? (refundPrefill.amountCents / 100).toFixed(2) : ""
  );
  const [refundMid, setRefundMid] = useState(refundPrefill?.processorMid ?? "");
  const [movingToRetention, setMovingToRetention] = useState(false);
  const [assignmentFlow, setAssignmentFlow] = useState<AssignmentFlowState | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showSelfAssignPrompt, setShowSelfAssignPrompt] = useState(shouldPromptSelfAssign);
  const [profileSelfAssigning, setProfileSelfAssigning] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    {
      id: string;
      first_name: string | null;
      last_name: string | null;
      stage: string | null;
      phone_mobile: string | null;
      email: string | null;
    }[]
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showRetentionExitModal, setShowRetentionExitModal] = useState(false);
  const pendingRetentionExit = useRef<{ stage: string; label: string; selectEl: HTMLSelectElement } | null>(null);

  const selfAssignSlot = useMemo((): "accounts" | "services" | null => {
    if (viewerDept.is_accounts && !assignedTo) return "accounts";
    if (viewerDept.is_services && !assignedServicesId) return "services";
    return null;
  }, [viewerDept, assignedTo, assignedServicesId]);

  useEffect(() => {
    if (!shouldPromptSelfAssign) setShowSelfAssignPrompt(false);
  }, [shouldPromptSelfAssign]);

  const current = normalizePipelineStage(stage);
  const isClosed = current === "closed";

  const nextStage = getNextStage(stage);
  const prevStage = getPrevStage(stage);
  const nextLabel = nextStage ? (STAGE_DISPLAY[nextStage] ?? nextStage) : null;
  const prevLabel = prevStage ? (STAGE_DISPLAY[prevStage] ?? prevStage) : null;

  const canCancel = canCancelClientToDnc(userRole);
  const showBack = Boolean(prevStage && prevLabel);
  const showForward = Boolean(nextStage && nextLabel);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [searchOpen]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const orFragment = buildSearchQuery(q);
    if (!orFragment) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, last_name, stage, phone_mobile, email")
        .eq("is_active", true)
        .or(orFragment)
        .limit(8);
      setSearchResults(data ?? []);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void runSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, runSearch]);

  async function applyStage(
    newStage: string,
    opts?: {
        skipAssignmentModal?: boolean;
      reminderAssigneeOverride?: string | null;
      /** Retention exit modal may jump non-adjacent stages. */
      allowStageSkip?: boolean;
    }
  ): Promise<boolean> {
    const oldS = normalizePipelineStage(stage);
    const forward = isForwardPipelineTransition(oldS, newStage);

    if (
      forward &&
      !opts?.allowStageSkip &&
      wouldSkipPipelineStages(oldS, newStage)
    ) {
      toast.error(
        "New Lead clients can only advance to Account Manager. Complete requirements and advance one stage at a time."
      );
      suppressDropdownRevert.current = false;
      return false;
    }

    if (forward) {
      const gate = blockAdvanceFromAccountManagerWithoutSignedWelcomePacket({
        fromStage: oldS,
        toStage: newStage,
        poaSignedAt: poaSignedAt ?? null,
        hasPoaDocument: hasPoaDocument ?? false,
      });
      if (gate.blocked) {
        setWelcomePacketGate(gate.reason ?? null);
        suppressDropdownRevert.current = false;
        return false;
      }
    }

    if (forward && newStage === "account_manager" && !opts?.skipAssignmentModal) {
      suppressDropdownRevert.current = true;
      setAssignmentFlow({
        title: "Assign Account Manager",
        department: "accounts",
        pendingStage: "account_manager",
      });
      return false;
    }

    if (forward && newStage === "client_services" && !opts?.skipAssignmentModal) {
      suppressDropdownRevert.current = true;
      setAssignmentFlow({
        title: "Assign Services",
        department: "services",
        pendingStage: "client_services",
      });
      return false;
    }

    setLoading(forward ? "advance" : "back");
    const supabase = createClient();

    if (forward) {
      const wp = blockAdvanceFromClientServicesWithoutPoa({
        fromStage: oldS,
        toStage: newStage,
        poaSignedAt: poaSignedAt ?? null,
        hasPoaDocument: hasPoaDocument ?? false,
      });
      if (wp.blocked) {
        toast.error(wp.reason ?? "Cannot advance.");
        setLoading(null);
        suppressDropdownRevert.current = false;
        return false;
      }
    }

    const effectiveRemindAssignee: string | null =
      opts?.reminderAssigneeOverride !== undefined
        ? opts.reminderAssigneeOverride
        : newStage === "client_services"
          ? assignedServicesId ?? assignedTo
          : assignedTo;

    const stageUpdate: Record<string, unknown> = {
      stage: newStage,
      stage_entered_at: new Date().toISOString(),
    };
    const { error: updateErr } = await supabase
      .from("clients")
      .update(stageUpdate)
      .eq("id", clientId);

    if (updateErr) {
      toast.error(toUserFacingError(updateErr.message));
      setLoading(null);
      suppressDropdownRevert.current = false;
      return false;
    }

    const auditAction = pipelineStageAuditAction(oldS, newStage);
    const { error: auditErr } = await supabase.from("audit_log").insert({
      client_id: clientId,
      action: auditAction,
      old_value: { stage: oldS },
      new_value: { stage: newStage },
      performed_by: performerId,
      performed_by_name: performerName,
    });

    if (auditErr) {
      console.warn("[ClientStageHeader] audit_log:", auditErr.message);
    }

    const tr = await handleStageTransition(supabase, {
      clientId,
      oldStage: oldS,
      newStage,
      mode: forward ? "advance" : "back",
    });
    if (tr.error) {
      console.warn("[workflow] handleStageTransition:", tr.error.message);
    }

    const notifyUserId =
      newStage === "client_services" ? effectiveRemindAssignee : assignedTo;
    if (notifyUserId && notifyUserId !== performerId) {
      const clientName = displayName.trim() || "Client";
      const stageLabel = STAGE_DISPLAY[newStage] ?? newStage;
      void supabase.from("notifications").insert({
        user_id: notifyUserId,
        type: "stage_change",
        title: "Client stage updated",
        body: `${clientName} moved to ${stageLabel}`,
        client_id: clientId,
        client_name: clientName,
        read: false,
        action_url: `/clients/${clientId}`,
      });
    }

    await runStageEntrySideEffectsServerAction({
      clientId,
      oldStage: oldS,
      newStage,
      assignedTo: effectiveRemindAssignee,
      performerId,
      forward,
    });

    if (forward) {
      if (!STAGES_WITH_ENTRY_SIDE_EFFECTS.has(newStage)) {
        await createAutoReminders(
          supabase,
          toast,
          clientId,
          newStage,
          effectiveRemindAssignee
        );
      }
    }

    const label = STAGE_DISPLAY[newStage] ?? newStage;
    toast.success(forward ? `Stage updated to ${label}` : `Returned to ${label}`);
    setLoading(null);
    suppressDropdownRevert.current = false;
    router.refresh();
    return true;
  }

  async function handleAssignmentModalAssign(userId: string, userName: string) {
    if (!assignmentFlow) return;
    setIsAssigning(true);
    const supabase = createClient();
    try {
      const updateField =
        assignmentFlow.department === "accounts"
          ? "assigned_to"
          : "assigned_services_id";
      const { error: uErr } = await supabase
        .from("clients")
        .update({ [updateField]: userId })
        .eq("id", clientId);
      if (uErr) throw uErr;
      const auditAction = `${assignmentFlow.department}_assigned`;
      const { error: aErr } = await supabase.from("audit_log").insert({
        client_id: clientId,
        action: auditAction,
        new_value: {
          new_id: userId,
          new_name: userName || "Team member",
          self_assigned: userId === performerId,
        },
        performed_by: performerId,
        performed_by_name: performerName,
      });
      if (aErr) console.warn("[ClientStageHeader] assignment audit:", aErr.message);
    } catch (e) {
      toast.error(toUserFacingError(e instanceof Error ? e.message : "Update failed"));
      setIsAssigning(false);
      return;
    }

    const { pendingStage, applyOpts } = assignmentFlow;
    setAssignmentFlow(null);
    await applyStage(pendingStage, {
      ...applyOpts,
      skipAssignmentModal: true,
      reminderAssigneeOverride: userId,
    });
    setIsAssigning(false);
  }

  async function handleAssignmentModalSkip() {
    if (!assignmentFlow) return;
    const { pendingStage, applyOpts } = assignmentFlow;
    setAssignmentFlow(null);
    await applyStage(pendingStage, {
      ...applyOpts,
      skipAssignmentModal: true,
    });
  }

  async function handleProfileSelfAssignConfirm() {
    const slot = selfAssignSlot;
    if (!slot) return;
    setProfileSelfAssigning(true);
    try {
      const supabase = createClient();
      const field = slot === "accounts" ? "assigned_to" : "assigned_services_id";
      const { error: uErr } = await supabase
        .from("clients")
        .update({ [field]: performerId })
        .eq("id", clientId);
      if (uErr) throw uErr;
      const auditAction =
        slot === "accounts" ? "accounts_assigned" : "services_assigned";
      const { error: aErr } = await supabase.from("audit_log").insert({
        client_id: clientId,
        action: auditAction,
        new_value: {
          new_id: performerId,
          new_name: performerName,
          self_assigned: true,
        },
        performed_by: performerId,
        performed_by_name: performerName,
      });
      if (aErr) console.warn("[ClientStageHeader] profile self-assign audit:", aErr.message);
      setShowSelfAssignPrompt(false);
      toast.success("You're assigned to this client");
      router.refresh();
    } catch (e) {
      toast.error(toUserFacingError(e instanceof Error ? e.message : "Assign failed"));
    } finally {
      setProfileSelfAssigning(false);
    }
  }

  async function handleDropdownStageChange(
    newStage: string,
    selectEl: HTMLSelectElement
  ) {
    const oldS = normalizePipelineStage(stage);
    if (newStage === oldS) return;

    if (oldS === "retention" && newStage !== "retention" && newStage !== "dnc") {
      const label = getStageDropdownOptionLabel(stage, newStage);
      pendingRetentionExit.current = { stage: newStage, label, selectEl };
      setShowRetentionExitModal(true);
      return;
    }

    if (oldS === "retention" && newStage === "dnc") {
      if (
        !window.confirm(
          "Move this client to DNC? This will deactivate their record."
        )
      ) {
        selectEl.value = oldS;
        return;
      }
      setLoading("advance");
      const supabase = createClient();
      const now = new Date().toISOString();
      // Setting is_active=false fires the DB trigger
      // `cancel_enrollments_on_client_inactive`, which cancels every active
      // email enrollment. Do NOT rely on any app-side cancel here.
      const { error: updErr } = await supabase
        .from("clients")
        .update({
          stage: "dnc",
          is_active: false,
          dnc_reason: "dnc",
          stage_entered_at: now,
        })
        .eq("id", clientId);
      if (updErr) {
        toast.error(toUserFacingError(updErr.message));
        setLoading(null);
        selectEl.value = oldS;
        return;
      }
      const { error: auditErr } = await supabase.from("audit_log").insert({
        client_id: clientId,
        action: "stage_advanced",
        old_value: { stage: oldS },
        new_value: { stage: "dnc", dnc_reason: "dnc" },
        performed_by: performerId,
        performed_by_name: performerName,
      });
      if (auditErr) {
        console.warn("[ClientStageHeader] audit_log:", auditErr.message);
      }
      const tr = await handleStageTransition(supabase, {
        clientId,
        oldStage: oldS,
        newStage: "dnc",
        mode: "advance",
      });
      if (tr.error) {
        console.warn("[workflow] handleStageTransition:", tr.error.message);
      }
      toast.success("Client moved to DNC");
      setLoading(null);
      router.refresh();
      return;
    }

    const ok = await applyStage(newStage);
    const skipRevert = suppressDropdownRevert.current;
    suppressDropdownRevert.current = false;
    if (!ok && !skipRevert) selectEl.value = oldS;
  }

  function onClickAdvance() {
    if (!nextStage || loading !== null) return;
    if (nextStage === "account_manager") {
      setAssignmentFlow({
        title: "Assign Account Manager",
        department: "accounts",
        pendingStage: "account_manager",
        applyOpts: {},
      });
      return;
    }
    void applyStage(nextStage);
  }

  function closeCancelReasonModal() {
    setShowCancelReasonModal(false);
    setSelectedCancelReason(null);
    setCancelNotes("");
    setCancelReasonBackToConfirm(false);
  }

  function openCancelReasonModal(fromConfirm: boolean) {
    setShowCancelConfirmModal(false);
    setCancelReasonBackToConfirm(fromConfirm);
    setSelectedCancelReason(null);
    setCancelNotes("");
    setShowCancelReasonModal(true);
  }

  async function handleMoveToRetention() {
    setMovingToRetention(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    const oldS = normalizePipelineStage(stage);

    try {
      const { error } = await supabase
        .from("clients")
        .update({ stage: "retention", stage_entered_at: now })
        .eq("id", clientId);

      if (error) throw error;

      const { error: auditErr } = await supabase.from("audit_log").insert({
        client_id: clientId,
        action: "moved_to_retention",
        old_value: { stage: oldS },
        new_value: { stage: "retention" },
        performed_by: performerId,
        performed_by_name: performerName,
      });
      if (auditErr) {
        console.warn("[ClientStageHeader] moved_to_retention audit:", auditErr.message);
      }

      void runStageEntrySideEffectsServerAction({
        clientId,
        oldStage: oldS,
        newStage: "retention",
        assignedTo,
        performerId,
        forward: true,
      });

      setShowCancelConfirmModal(false);
      toast.success("Client moved to Retention");
      router.refresh();
    } catch (err) {
      toast.error(
        toUserFacingError(
          err instanceof Error ? err.message : "Failed to move to Retention"
        )
      );
      console.error(err);
    } finally {
      setMovingToRetention(false);
    }
  }

  async function handleConfirmCancel() {
    if (!selectedCancelReason) return;
    setCancelling(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    const outcome = resolveClientCancelUpdate(selectedCancelReason);
    const reasonLabel = getCancelReasonLabel(selectedCancelReason);

    try {
      const { error } = await supabase
        .from("clients")
        .update({
          stage: outcome.stage,
          is_active: outcome.is_active,
          dnc_reason: outcome.dnc_reason,
          stage_entered_at: now,
        })
        .eq("id", clientId);

      if (error) throw error;

      const { error: logErr } = await supabase.from("cancellation_logs").insert({
        client_id: clientId,
        reason: selectedCancelReason,
        notes: cancelNotes.trim() ? cancelNotes.trim() : null,
        performed_by: performerId,
        performed_by_name: performerName,
      });
      if (logErr) {
        console.warn("[ClientStageHeader] cancellation_logs:", logErr.message);
      }

      const { error: auditErr } = await supabase.from("audit_log").insert({
        client_id: clientId,
        action: "client_cancelled",
        new_value: {
          reason: selectedCancelReason,
          reason_label: reasonLabel,
          notes: cancelNotes.trim() || null,
          cancelled_by: performerId,
          cancelled_at: now,
          stage: outcome.stage,
          dnc_reason: outcome.dnc_reason,
        },
        performed_by: performerId,
        performed_by_name: performerName,
      });
      if (auditErr) {
        console.warn("[ClientStageHeader] client_cancelled audit:", auditErr.message);
      }

      // Starts the refund lifecycle. The cancellation above is unchanged and
      // already stands on its own, so a failure here must not roll it back —
      // the Refunds queue surfaces gaps instead.
      if (selectedCancelReason === "refund") {
        const refundAmountCents = parseRefundAmountCents(refundAmount);
        const refundProcessorMid = refundMid.trim() || null;
        const { data: refundRow, error: refundErr } = await supabase
          .from("refunds")
          .insert({
            client_id: clientId,
            amount_cents: refundAmountCents,
            processor_mid: refundProcessorMid,
            status: "requested",
            requested_at: now,
            requested_by: performerId,
            requested_by_name: performerName,
            notes: cancelNotes.trim() || null,
          })
          .select("id")
          .single();
        if (refundErr) {
          console.warn("[ClientStageHeader] refunds insert:", refundErr.message);
          toast.error(
            "Client cancelled, but the refund could not be added to the Refunds queue. Add it manually."
          );
        } else {
          // Pairs with refund_processed so the client's history shows the request
          // as well as the payout, which can be days apart.
          const { error: refundAuditErr } = await supabase.from("audit_log").insert({
            client_id: clientId,
            action: "refund_requested",
            new_value: {
              refund_id: refundRow?.id ?? null,
              amount: formatMoneyUsdFromCents(refundAmountCents),
              processor_mid: refundProcessorMid,
            },
            performed_by: performerId,
            performed_by_name: performerName,
          });
          if (refundAuditErr) {
            console.warn(
              "[ClientStageHeader] refund_requested audit:",
              refundAuditErr.message
            );
          }
        }
      }

      const { error: commErr } = await supabase.from("communications").insert({
        client_id: clientId,
        type: "note",
        direction: "internal",
        subject: "Cancellation",
        body: `Client account cancelled. Reason: ${reasonLabel}${cancelNotes.trim() ? `. Notes: ${cancelNotes.trim()}` : ""}`,
        duration_seconds: null,
        recorded_by: performerId,
        sent_at: now,
      });
      if (commErr) {
        console.warn("[ClientStageHeader] cancel note:", commErr.message);
      }

      void cancelActiveSequenceEnrollmentsServerAction(clientId);

      closeCancelReasonModal();
      setShowCancelConfirmModal(false);
      toast.success("Client account cancelled");
      router.push("/clients");
    } catch (err) {
      toast.error(
        toUserFacingError(
          err instanceof Error ? err.message : "Failed to process cancellation"
        )
      );
      console.error(err);
    } finally {
      setCancelling(false);
    }
  }

  const stageDropdownOpts = getStageDropdownOptions(stage);
  const showStageSelect = Boolean(
    canUseStageDropdown(userRole) &&
      !isClosed &&
      stageDropdownOpts &&
      stageDropdownOpts.some((o) => o.value === current)
  );

  return (
    <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="crm-page-title text-2xl tracking-tight sm:text-3xl">{displayName}</h1>
        </div>

        <div className="mt-2 flex items-center gap-0">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Account Manager
            </span>
            <span className="truncate text-sm font-medium text-gray-800 dark:text-slate-100">
              {accountsUser?.full_name?.trim() ? (
                accountsUser.full_name.trim()
              ) : (
                <span className="text-xs italic text-gray-400 dark:text-slate-500">Unassigned</span>
              )}
            </span>
          </div>

          <div className="mx-4 h-8 w-px shrink-0 bg-gray-200 dark:bg-[#2E2E2E]" />

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Client Services
            </span>
            <span className="truncate text-sm font-medium text-gray-800 dark:text-slate-100">
              {servicesUser?.full_name?.trim() ? (
                servicesUser.full_name.trim()
              ) : (
                <span className="text-xs italic text-gray-400 dark:text-slate-500">Unassigned</span>
              )}
            </span>
          </div>
        </div>

      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
        {showStageSelect && stageDropdownOpts ? (
          <select
            value={current}
            onChange={(e) =>
              void handleDropdownStageChange(e.target.value, e.currentTarget)
            }
            disabled={loading !== null}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 focus:border-[#A87830] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-200"
            aria-label="Client stage"
          >
            {stageDropdownOpts.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <StagePill stage={current} />
        )}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition-colors hover:border-[#A87830] hover:text-[#A87830] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-400 dark:hover:border-[#A87830] dark:hover:text-[#A87830]"
          title="Search clients"
          aria-label="Search clients"
        >
          <Search className="h-4 w-4" />
        </button>
        {isClosed ? (
          <span className="inline-flex items-center rounded-full bg-slate-200 px-4 py-2 text-sm font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-100">
            Case Closed
          </span>
        ) : (
          <>
            {canCancel ? (
              <button
                type="button"
                onClick={() => {
                  if (current === "retention") {
                    openCancelReasonModal(false);
                  } else {
                    setShowCancelConfirmModal(true);
                  }
                }}
                disabled={
                  loading !== null || cancelling || movingToRetention
                }
                className="flex items-center gap-2 rounded-lg border border-red-400 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] disabled:opacity-50 dark:hover:bg-red-950/30"
                title="Cancel client"
                aria-label="Cancel client"
              >
                {cancelling || movingToRetention ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Cancel
              </button>
            ) : null}
          </>
        )}
      </div>

      {showCancelConfirmModal ? (
        <ModalOverlay
          labelledBy="cancel-confirm-title"
          onBackdropClick={() => {
            if (!movingToRetention) setShowCancelConfirmModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-[#1C1C1C] dark:shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3
                  id="cancel-confirm-title"
                  className="text-base font-semibold text-slate-900 dark:text-white"
                >
                  Cancel Client?
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Choose how to proceed for {displayName}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => openCancelReasonModal(true)}
                disabled={movingToRetention}
                className="group flex w-full items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:hover:bg-red-950/50"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    Cancel — Mark as Inactive
                  </p>
                  <p className="mt-0.5 text-xs text-red-500 dark:text-red-400/90">
                    Client will be deactivated immediately
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-red-400 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={() => void handleMoveToRetention()}
                disabled={movingToRetention}
                className="group flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Move to Retention
                  </p>
                  <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400/90">
                    Keep client active, attempt to retain
                  </p>
                </div>
                {movingToRetention ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-amber-400 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => !movingToRetention && setShowCancelConfirmModal(false)}
              className="mt-3 w-full py-2 text-sm text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
            >
              Never mind, keep client active
            </button>
          </div>
        </ModalOverlay>
      ) : null}

      {showCancelReasonModal ? (
        <ModalOverlay
          labelledBy="cancel-reason-title"
          onBackdropClick={() => {
            if (!cancelling) closeCancelReasonModal();
          }}
        >
          {/*
           * Picking "Refund Requested" adds fields and can push this past the
           * bottom of a laptop window, so the panel is capped at the window
           * height with the reasons scrolling inside it. Back and Confirm sit
           * outside that scroll area and stay put.
           */}
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-lg dark:bg-[#1C1C1C] dark:shadow-xl">
            <div className="overflow-y-auto p-6">
              <h3
                id="cancel-reason-title"
                className="mb-1 text-base font-semibold text-slate-900 dark:text-white"
              >
                Cancellation Reason
              </h3>
              <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
                Select the reason for cancelling {displayName}&apos;s account
              </p>

              <div className="space-y-2">
                {CANCEL_REASONS.map((reason) => (
                  <button
                    key={reason.value}
                    type="button"
                    onClick={() =>
                      setSelectedCancelReason(reason.value as CancelReasonValue)
                    }
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      selectedCancelReason === reason.value
                        ? "border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-950/30"
                        : "border-slate-200 hover:border-slate-300 dark:border-[#2E2E2E] dark:hover:border-slate-500"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {reason.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {reason.description}
                    </p>
                  </button>
                ))}
              </div>

              {selectedCancelReason === "refund" ? (
                <div className="mt-4 space-y-3 rounded-lg border border-purple-200 bg-purple-50/60 p-3 dark:border-purple-800 dark:bg-purple-950/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-800 dark:text-purple-200">
                    Refund details
                  </p>
                  <div>
                    <label
                      htmlFor="refund-amount"
                      className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Refund amount
                    </label>
                    <input
                      id="refund-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0.00"
                      className="crm-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="refund-mid"
                      className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Processor / MID
                    </label>
                    <select
                      id="refund-mid"
                      value={refundMid}
                      onChange={(e) => setRefundMid(e.target.value)}
                      className="crm-input w-full text-sm"
                    >
                      <option value="">Not sure yet</option>
                      {merchantOptions.map((mid) => (
                        <option key={mid} value={mid}>
                          {mid}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              <textarea
                placeholder={
                  selectedCancelReason === "refund"
                    ? "Refund notes (optional)"
                    : "Additional notes (optional)"
                }
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                className="crm-input mt-4 h-20 w-full resize-none text-sm"
              />
            </div>

            <div className="flex gap-3 border-t border-slate-100 px-6 py-4 dark:border-[#2E2E2E]">
              <button
                type="button"
                onClick={() => {
                  if (cancelling) return;
                  if (cancelReasonBackToConfirm) {
                    closeCancelReasonModal();
                    setShowCancelConfirmModal(true);
                  } else {
                    closeCancelReasonModal();
                  }
                }}
                className="crm-btn-secondary flex-1"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCancel()}
                disabled={!selectedCancelReason || cancelling}
                className="crm-btn-primary flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelling…
                  </>
                ) : (
                  "Confirm Cancellation"
                )}
              </button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {welcomePacketGate ? (
        <ModalOverlay
          labelledBy="welcome-packet-gate-title"
          className="z-[200] bg-black/40"
          onBackdropClick={() => setWelcomePacketGate(null)}
        >
          <div className="crm-modal-panel w-full max-w-sm">
            <div className="mb-2 flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
                aria-hidden
              />
              <h3
                id="welcome-packet-gate-title"
                className="text-lg font-bold text-gray-900 dark:text-white"
              >
                {WELCOME_PACKET_GATE_TITLE}
              </h3>
            </div>
            <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
              {welcomePacketGate}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWelcomePacketGate(null)}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
              >
                Close
              </button>
              <Link
                href={`/clients/${clientId}?tab=documents`}
                onClick={() => setWelcomePacketGate(null)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#A87830] py-2.5 text-sm font-medium text-[#161616] hover:bg-[#8C6428]"
              >
                <PenLine className="h-4 w-4" aria-hidden />
                Go to E-Sign
              </Link>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {showRetentionExitModal ? (
        <ModalOverlay
          labelledBy="retention-exit-title"
          onBackdropClick={() => {
            if (loading === null) {
              pendingRetentionExit.current!.selectEl.value = "retention";
              pendingRetentionExit.current = null;
              setShowRetentionExitModal(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-[#1C1C1C] dark:shadow-xl">
            <h3
              id="retention-exit-title"
              className="mb-1 text-base font-semibold text-slate-900 dark:text-white"
            >
              Move out of Retention?
            </h3>
            <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
              This will move{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {displayName}
              </span>{" "}
              to{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {pendingRetentionExit.current?.label}
              </span>
              . This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => {
                  pendingRetentionExit.current!.selectEl.value = "retention";
                  pendingRetentionExit.current = null;
                  setShowRetentionExitModal(false);
                }}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading !== null}
                onClick={async () => {
                  const pending = pendingRetentionExit.current;
                  if (!pending) return;
                  setShowRetentionExitModal(false);
                  const ok = await applyStage(pending.stage, {
                    skipAssignmentModal: true,
                    allowStageSkip: true,
                  });
                  if (!ok) pending.selectEl.value = "retention";
                  pendingRetentionExit.current = null;
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#A87830] py-2.5 text-sm font-medium text-[#161616] hover:bg-[#8C6428] disabled:opacity-50"
              >
                {loading !== null ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Confirm
              </button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {showSelfAssignPrompt && selfAssignSlot ? (
        <ModalOverlay
          labelledBy="self-assign-title"
          className="z-[245] bg-black/40"
        >
          <div className="crm-modal-panel w-full max-w-sm">
            <h3 id="self-assign-title" className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              Assign yourself to this client?
            </h3>
            <p className="mb-5 text-sm text-gray-500 dark:text-slate-400">
              This client doesn&apos;t have a
              {selfAssignSlot === "accounts"
                ? " Account Manager"
                : " Client Services"}{" "}
              yet. Would you like to take this client?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSelfAssignPrompt(false)}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-[#2E2E2E] dark:text-slate-300 dark:hover:bg-[#242424]"
              >
                Not now
              </button>
              <button
                type="button"
                disabled={profileSelfAssigning}
                onClick={() => void handleProfileSelfAssignConfirm()}
                className="flex-1 rounded-lg bg-[#A87830] py-2.5 text-sm font-medium text-[#161616] transition-colors hover:bg-[#8C6428] disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {profileSelfAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Yes, assign me"
                )}
              </button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      <AssignmentModal
        open={assignmentFlow !== null}
        title={assignmentFlow?.title ?? ""}
        department={assignmentFlow?.department ?? "accounts"}
        loading={isAssigning}
        onAssign={(id, name) => void handleAssignmentModalAssign(id, name)}
        onSkip={() => void handleAssignmentModalSkip()}
      />

      {searchOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/50 px-4 pb-4 pt-24"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-[#1C1C1C]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 p-3 dark:border-[#2E2E2E]">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, phone, or email…"
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
              />
              {searchLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {searchResults.length > 0 ? (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-[#2E2E2E]">
                {searchResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-[#242424]"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          sessionStorage.setItem("clientListUrl", window.location.href);
                        }
                        setSearchOpen(false);
                        router.push(`/clients/${c.id}`);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate pr-2 font-medium text-slate-900 dark:text-white">
                        {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                      </span>
                      <span className="shrink-0 text-right text-xs text-slate-400">
                        {c.phone_mobile || c.email || ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : searchQuery.trim() && !searchLoading ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                No clients found
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
