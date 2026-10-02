import { ROLE_LABELS } from "@/lib/constants/roles";

/** Human-readable role labels for CRM UI (DB values stay snake_case). */
export function getRoleDisplayName(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
