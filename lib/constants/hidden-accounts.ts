/** Staff emails hidden from CRM lists/dropdowns unless the viewer is a developer. */
export const HIDDEN_FROM_NON_DEV_EMAILS = [
  "cs@debtsupportpros.com",
  "jessica@debtsupportpros.com",
  "dev@debtsupportpros.com",
] as const;

export function isHiddenFromRole(
  email: string | null | undefined,
  viewerRole: string
): boolean {
  if (viewerRole === "dev") return false;
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return HIDDEN_FROM_NON_DEV_EMAILS.some((h) => h.toLowerCase() === e);
}
