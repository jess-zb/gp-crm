import type { UserRole } from "@/lib/types/user-role";

/** Core CRM operators (not attorney, not portal client). */
export function isCrmStaffRole(role: string): role is UserRole {
  return role === "dev" || role === "admin" || role === "acct_manager";
}

export function isDev(role: string): boolean {
  return role === "dev";
}

export function isDevOrAdmin(role: string): boolean {
  return role === "dev" || role === "admin";
}

/** Full operational control (not acct_manager). */
export function isOpsLead(role: string): boolean {
  return role === "dev" || role === "admin";
}

export function isAcctManager(role: string): boolean {
  return role === "acct_manager";
}

/** Documents / client APIs: leadership + acct managers see all; attorney assigned only. */
export function canAccessClientRecord(
  role: string,
  userId: string,
  client: { assigned_to: string | null; attorney_id: string | null }
): boolean {
  if (role === "dev" || role === "admin" || role === "acct_manager") return true;
  if (role === "attorney" && client.attorney_id === userId) return true;
  return false;
}

/** Pipeline / clients list: no assignee filter (all roles see full lists). */
export function scopedAssigneeUserId(
  _role: string,
  _userId: string
): string | null {
  return null;
}

export function canDeleteClientRecord(role: string): boolean {
  return role === "dev" || role === "admin";
}

export function canImportClientsCsv(role: string): boolean {
  return role === "dev" || role === "admin";
}

/**
 * Master kill switch for CRM CSV / clipboard data exports. Unset = off.
 * `CLIENT_CSV_EXPORT_ENABLED=true` is accepted as a legacy alias.
 */
export function isCrmCsvExportEnabled(): boolean {
  const master = process.env.CRM_CSV_EXPORT_ENABLED?.trim().toLowerCase();
  const legacy = process.env.CLIENT_CSV_EXPORT_ENABLED?.trim().toLowerCase();
  return master === "true" || legacy === "true";
}

/** Clients list "Export Selected" CSV (name, email, phone). */
export function canExportClientsCsv(role: string): boolean {
  return isCrmCsvExportEnabled() && isOpsLead(role);
}

/** Reports team-performance CSV. */
export function canExportReportsCsv(role: string): boolean {
  return isCrmCsvExportEnabled() && canAccessReports(role);
}

/** Bulk-invite results CSV (dev page). */
export function canExportBulkInviteCsv(role: string): boolean {
  return isCrmCsvExportEnabled() && isDev(role);
}

export function canBulkDeleteClients(role: string): boolean {
  return role === "dev" || role === "admin";
}

/** MIDs and their e-sign documents — leadership only. */
export function canManageMids(role: string): boolean {
  return isOpsLead(role);
}

export function canAccessTeamPage(role: string): boolean {
  return role === "dev" || role === "admin";
}

/**
 * "All Clients" list tab — dev only. The tab does not partition cleanly against
 * Active/Archives (see fetchClientsListPage), so everyone else reaches those
 * records through search instead.
 */
export function canSeeAllClientsTab(role: string): boolean {
  return role === "dev";
}

/**
 * Client Services priority board — leadership plus account managers who are in
 * the Services department (`profiles.is_services`). Account managers outside
 * Services do not see it.
 */
export function canAccessPriorityBoard(
  role: string,
  isServices: boolean | null | undefined
): boolean {
  if (role === "dev" || role === "admin") return true;
  return role === "acct_manager" && isServices === true;
}

/**
 * Refund queue and Mark Refunded — dev and admin only. Requesting a refund is
 * separate and follows canCancelClientToDnc.
 */
export function canAccessRefundQueue(role: string): boolean {
  return role === "dev" || role === "admin";
}

export function canAccessReports(role: string): boolean {
  return role === "dev" || role === "admin";
}

/** Attorney Queue (portal bulk assign) — dev and admin only. */
export function canAccessAttorneyQueue(role: string): boolean {
  return isOpsLead(role);
}

/** Activity / audit-style sidebar on client profile: dev and admin only. */
export function canViewClientActivityLog(role: string): boolean {
  return role === "dev" || role === "admin";
}

/** Checklist bypass: dev and admin only. */
export function canBypassChecklist(role: string): boolean {
  return role === "dev" || role === "admin";
}

/** Billing cards: add, view, edit, attach collection letter. */
export function canEditBillingCards(role: string): boolean {
  return ["dev", "admin", "acct_manager"].includes(role);
}

/** Kept for the clickable auth pill affordance. */
export function canEditBillingCardAuthorizationOnly(role: string): boolean {
  return role === "acct_manager";
}

/** Billing cards: delete dev and admin only. */
export function canDeleteBillingCards(role: string): boolean {
  return role === "dev" || role === "admin";
}

/** Reassign client (assigned_to): dev, admin, and account managers. */
export function canReassignClient(role: string): boolean {
  return role === "dev" || role === "admin" || role === "acct_manager";
}

/** Assign / change clients.attorney_id (Account tab): dev and admin only. */
export function canEditAttorneyAssignment(role: string): boolean {
  return role === "dev" || role === "admin";
}

/** See assigned attorney on Account tab: leadership + acct managers (read-only for acct_manager). */
export function canViewAssignedAttorneyField(role: string): boolean {
  return (
    role === "dev" || role === "admin" || role === "acct_manager"
  );
}

/** Delete documents on profile: dev and admin only. */
export function canDeleteDocuments(role: string): boolean {
  return role === "dev" || role === "admin";
}

/** Manual stage advance/revert buttons: dev only (auto-advance via POA, Shape, etc.). */
export function canMoveClientStage(role: string): boolean {
  return role === "dev";
}

/** Stage dropdown on client profile: staff can change stage (RLS enforces writes). */
export function canUseStageDropdown(role: string): boolean {
  return isCrmStaffRole(role);
}

/** Cancel client / DNC from profile (Retention close + standard cancel): dev, admin, acct_manager only. */
export function canCancelClientToDnc(role: string): boolean {
  return role === "dev" || role === "admin" || role === "acct_manager";
}

/** Assignee dropdown on new client / bulk: acct managers (and dev/admin for consistency). */
export const ASSIGNEE_PROFILE_ROLES = [
  "dev",
  "admin",
  "acct_manager",
] as const;

export const COMMS_DIRECTORY_ROLES = [
  "dev",
  "admin",
  "acct_manager",
  "attorney",
] as const;
