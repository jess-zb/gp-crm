import { isCrmStaffRole, isOpsLead } from "@/lib/roles";

/**
 * Kill switch. Unset means on so production works without a forgotten env var.
 */
export function isEsignFeatureEnabled(): boolean {
  return process.env.ESIGN_ENABLED?.trim().toLowerCase() !== "false";
}

/**
 * Sending is a normal staff capability. The source project gated this on a
 * hardcoded list of six email addresses, duplicated into the RLS policies.
 */
export function canUseEsignStaffUi(role: string | null | undefined): boolean {
  return isCrmStaffRole(role ?? "");
}

/** Uploading a template PDF and placing its fields — leadership only. */
export function canManageEsignTemplates(role: string | null | undefined): boolean {
  return isOpsLead(role ?? "");
}
