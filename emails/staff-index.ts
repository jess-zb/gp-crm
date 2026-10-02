import AttorneyPortalAssignment from "./attorney-portal-assignment";

/** Staff / attorney transactional emails (not client drip sequences). */
export const staffTemplateRegistry = {
  attorney_portal_assignment: AttorneyPortalAssignment,
} as const;

export type StaffTemplateKey = keyof typeof staffTemplateRegistry;

export const STAFF_TEMPLATE_SUBJECTS: Record<StaffTemplateKey, string> = {
  attorney_portal_assignment: "New Case Assigned — DebtSupportPros Attorney Portal",
};
