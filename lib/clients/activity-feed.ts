import { getStageLabel } from "@/lib/constants/stages";
import { documentTypeLabel } from "@/lib/clients/document-upload";

export type ActivityFeedItem = {
  id: string;
  created_at: string;
  icon: string;
  description: string;
  actorName: string;
};

type AuditRow = {
  id: string;
  action: string;
  performed_by_name: string | null;
  created_at: string;
  new_value?: AuditPayload;
};

interface AuditPayload {
  stage?: string;
  old_status?: string;
  new_status?: string;
  last_four?: string;
  creditor_name?: string;
  card_id?: string;
  file_name?: string;
  document_type?: string;
  direction?: string;
  duration_seconds?: number;
  matched_by?: string;
  item?: string | number;
  description?: string;
  reason?: string;
  trigger?: string;
  old_name?: string;
  new_name?: string;
  self_assigned?: boolean;
  amount?: string;
  processor_mid?: string | null;
}

type CommRow = {
  id: string;
  type: string;
  body: string | null;
  sent_at: string | null;
  recorded_by: string | null;
};

type DocRow = {
  id: string;
  document_type: string;
  file_name: string;
  created_at: string | null;
  uploaded_by: string | null;
  is_collection_letter?: boolean | null;
};

function stageFromNewValue(newValue: AuditPayload | undefined): string {
  if (!newValue) return "";
  const s = newValue.stage;
  return typeof s === "string" ? s : "";
}

function auditIcon(action: string): string {
  if (action === "card_added") return "💳";
  if (action === "card_authorization_updated") return "💳";
  if (action === "client_cancelled") return "🚫";
  if (action === "appointment_completed") return "✅";
  if (action === "profile_reviewed" || action === "profile_review_cleared") return "✅";
  if (action.includes("stage")) return "🔁";
  if (action.includes("viewed")) return "👁";
  return "📋";
}

function commIcon(type: string): string {
  switch (type) {
    case "call":
      return "📞";
    case "sms":
      return "💬";
    case "email":
      return "✉️";
    case "note":
      return "📝";
    default:
      return "💬";
  }
}

export type ClientCardLookup = Record<
  string,
  { creditor_name?: string | null; last_four?: string | null }
>;

/** Short titles for Communications tab activity log (audit_log.action). */
export const ACTION_LABELS: Record<string, string> = {
  // Stage changes
  stage_advanced: "Stage Advanced",
  stage_reverted: "Stage Moved Back",
  stage_changed: "Stage Updated",
  stage_auto_advanced: "Stage Auto-Advanced",
  client_reactivated: "Client Reactivated",
  case_sent_to_attorneys: "Case Sent to Attorneys",

  // Assignments
  accounts_assigned: "Accounts Assigned",
  accounts_reassigned: "Accounts Reassigned",
  services_assigned: "Services Assigned",
  self_assigned: "Self-Assigned",

  // Documents
  document_uploaded: "File Uploaded",
  audio_recording_uploaded: "Audio Recording Uploaded",
  collection_letter_uploaded: "Collection Letter Uploaded",
  poa_uploaded: "POA Uploaded",

  // Communications (manual comms may also appear in audit in some flows)
  note: "Note Added",
  call: "Call Logged",
  email: "Email Sent",
  sms: "Text Sent",
  call_auto_logged: "Call Logged",
  sms_auto_logged: "Text Sent",

  // System
  welcome_packet_resent: "Welcome Packet Resent",

  // Appointments
  appointment_created: "Appointment Set",
  appointment_completed: "Appointment Completed",
  appointment_deleted: "Appointment Removed",

  // Cancel / DNC / archive
  client_cancelled: "Client Cancelled",
  client_dnc: "Marked DNC",
  client_moved_to_dnc: "Marked DNC",
  client_archived: "Archived",

  // Billing / checklist / profile
  card_added: "Card Added",
  card_authorization_updated: "Card Authorization Updated",
  checklist_completed: "Checklist Updated",
  // Distinct from the line above: the client Activity Log renders only this
  // label, so sharing one would make ticking and undoing indistinguishable.
  checklist_uncompleted: "Checklist Item Reopened",
  refund_requested: "Refund Requested",
  refund_processed: "Refund Processed",
  profile_reviewed: "Profile Reviewed",
  profile_review_cleared: "Review Cleared",
  client_record_viewed: "Profile Viewed",
  drip_reset: "Email Sequence Reset",
};

export function getActivityActionLabel(action: string | null): string {
  const key = (action ?? "").trim();
  if (!key) return "Activity";
  if (ACTION_LABELS[key]) return ACTION_LABELS[key]!;
  const human = key.replace(/_/g, " ");
  return human.charAt(0).toUpperCase() + human.slice(1);
}

function cardAddedDescription(
  newValue: AuditPayload | undefined,
  cardsById?: ClientCardLookup
): string {
  if (!newValue) {
    return "Card added";
  }
  const v = newValue;

  let creditor = (v.creditor_name ?? "").trim();
  let last = (v.last_four ?? "").replace(/\D/g, "").slice(0, 4);

  if (v.card_id && cardsById?.[v.card_id]) {
    const cardRef = cardsById[v.card_id];
    if (!creditor && cardRef.creditor_name) creditor = String(cardRef.creditor_name).trim();
    if (!last && cardRef.last_four) {
      last = String(cardRef.last_four).replace(/\D/g, "").slice(0, 4);
    }
  }

  const displayCreditor = creditor || "Card";
  const displayLast = last.length === 4 ? last : "????";
  return `Card added: ${displayCreditor} ••••${displayLast}`;
}

/**
 * User-facing line for a single `audit_log` row (activity sidebar + feed).
 */
export function formatAuditDescription(
  entry: Pick<AuditRow, "action" | "new_value" | "performed_by_name">,
  cardsById?: ClientCardLookup
): string {
  const action = entry.action ?? "";
  const nv = entry.new_value;
  const o = nv;

  if (action === "stage_advanced") {
    const newStage = stageFromNewValue(nv);
    const stageLabel = newStage ? getStageLabel(newStage) : "—";
    return `Advanced to: ${stageLabel}`;
  }
  if (action === "stage_reverted") {
    const newStage = stageFromNewValue(nv);
    const stageLabel = newStage ? getStageLabel(newStage) : "—";
    return `Reverted to: ${stageLabel}`;
  }
  if (action === "stage_auto_advanced") {
    const newStage = stageFromNewValue(nv);
    const stageLabel = newStage ? getStageLabel(newStage) : "—";
    return `Auto-advanced to: ${stageLabel} (collection letter uploaded)`;
  }
  if (action === "case_sent_to_attorneys") {
    return "Case sent to attorneys";
  }
  if (action === "card_added") {
    return cardAddedDescription(nv, cardsById);
  }
  if (action === "card_authorization_updated") {
    const oldS = typeof o?.old_status === "string" ? o.old_status.trim() : "";
    const newS = typeof o?.new_status === "string" ? o.new_status.trim() : "";
    const last = typeof o?.last_four === "string" ? o.last_four.replace(/\D/g, "").slice(0, 4) : "";
    const lastPart = last.length === 4 ? ` ••••${last}` : "";
    const cred = typeof o?.creditor_name === "string" ? o.creditor_name.trim() : "";
    const head = cred ? `${cred}${lastPart}` : "Card";
    return `Authorization updated (${head}): ${oldS || "—"} → ${newS || "—"}`;
  }
  if (action === "document_uploaded") {
    const file = typeof o?.file_name === "string" ? o.file_name.trim() : "";
    const docType = typeof o?.document_type === "string" ? o.document_type : "";
    return `Document uploaded: ${file || docType || "document"}`;
  }
  if (action === "call_auto_logged") {
    const direction = typeof o?.direction === "string" ? o.direction : "";
    const sec = o?.duration_seconds;
    const durationPart =
      typeof sec === "number" && Number.isFinite(sec) && sec > 0
        ? `${Math.round(sec / 60)} min`
        : "no duration";
    return `Call logged: ${direction} (${durationPart})`;
  }
  if (action === "sms_auto_logged") {
    const direction = typeof o?.direction === "string" ? o.direction : "";
    return `Text logged: ${direction}`;
  }
  if (action === "welcome_packet_resent") {
    return "Welcome packet resent for signature";
  }
  if (action === "client_record_viewed") {
    return `Profile viewed by ${(entry.performed_by_name ?? "").trim() || "—"}`;
  }
  if (action === "checklist_completed") {
    const item = o?.item != null ? String(o.item) : "";
    return `Checklist: ${item || "item"} completed`;
  }
  if (action === "checklist_uncompleted") {
    const item = o?.item != null ? String(o.item) : "";
    return `Checklist: ${item || "item"} reopened`;
  }
  if (action === "refund_requested" || action === "refund_processed") {
    const amount = o?.amount != null ? String(o.amount) : "";
    const mid = o?.processor_mid != null ? String(o.processor_mid) : "";
    const verb = action === "refund_requested" ? "requested" : "processed";
    return `Refund ${verb}${amount ? ` — ${amount}` : ""}${mid ? ` on ${mid}` : ""}`;
  }
  if (action === "appointment_created") {
    const desc =
      typeof o?.description === "string" ? o.description.trim() : "";
    return desc ? `Appointment set: ${desc}` : "Appointment set";
  }
  if (action === "appointment_completed") {
    const desc =
      typeof o?.description === "string" ? o.description.trim() : "";
    return `Appointment completed: ${desc}`;
  }
  if (action === "client_cancelled") {
    const reason = typeof o?.reason === "string" ? o.reason.trim() : "";
    const reasonPart = reason ? reason.replace(/_/g, " ") : "—";
    return `Client cancelled — ${reasonPart}`;
  }
  if (action === "accounts_reassigned") {
    const oldN = typeof o?.old_name === "string" ? o.old_name.trim() : "—";
    const newN = typeof o?.new_name === "string" ? o.new_name.trim() : "—";
    return `Accounts reassigned: ${oldN} → ${newN}`;
  }
  if (action === "accounts_assigned" || action === "services_assigned") {
    const role =
      action === "accounts_assigned" ? "Account Manager" : "Client Services";
    const newN = typeof o?.new_name === "string" ? o.new_name.trim() : "";
    const self = !!o?.self_assigned;
    if (self) return `${role} self-assigned${newN ? `: ${newN}` : ""}`;
    return `${role} assigned: ${newN || "—"}`;
  }
  if (action === "moved_to_retention") {
    return "Moved to Retention";
  }
  if (action === "profile_reviewed") {
    return `Profile reviewed by ${(entry.performed_by_name ?? "").trim() || "—"}`;
  }
  if (action === "profile_review_cleared") {
    return `Review mark cleared by ${(entry.performed_by_name ?? "").trim() || "—"}`;
  }

  const human = action.replace(/_/g, " ");
  return human.charAt(0).toUpperCase() + human.slice(1);
}

export function mergeActivityFeed(input: {
  audits: AuditRow[];
  communications: CommRow[];
  documents: DocRow[];
  nameById: Record<string, string>;
  /** Resolve card_added audit rows when `last_four` was not stored on the audit payload */
  cardsById?: ClientCardLookup;
}): ActivityFeedItem[] {
  const out: ActivityFeedItem[] = [];

  for (const a of input.audits) {
    const action = a.action ?? "";
    out.push({
      id: `audit-${a.id}`,
      created_at: a.created_at,
      icon: auditIcon(action),
      description: formatAuditDescription(a, input.cardsById),
      actorName: a.performed_by_name?.trim() || "—",
    });
  }

  for (const c of input.communications) {
    const t = c.type ?? "note";
    const verb =
      t === "call"
        ? "Call logged"
        : t === "sms"
          ? "Text logged"
          : t === "email"
            ? "Email logged"
            : t === "note"
              ? "Note added"
              : "Communication";
    out.push({
      id: `comm-${c.id}`,
      created_at: c.sent_at ?? new Date().toISOString(),
      icon: commIcon(t),
      description: verb,
      actorName: c.recorded_by ? input.nameById[c.recorded_by] ?? "—" : "—",
    });
  }

  for (const d of input.documents) {
    if (d.document_type === "collection_letter" || d.is_collection_letter === true) {
      continue;
    }
    const docType = documentTypeLabel(d.document_type);
    const docName = d.file_name?.trim() || "file";
    out.push({
      id: `doc-${d.id}`,
      created_at: d.created_at ?? new Date().toISOString(),
      icon: "📎",
      description: `Document uploaded: ${docType} (${docName})`,
      actorName: d.uploaded_by ? input.nameById[d.uploaded_by] ?? "—" : "—",
    });
  }

  out.sort(
    (x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
  );
  return out.slice(0, 40);
}
