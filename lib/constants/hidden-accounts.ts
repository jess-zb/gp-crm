/** Staff emails hidden from CRM lists/dropdowns unless the viewer is a developer. */
export const HIDDEN_FROM_NON_DEV_EMAILS = ["dev@goldenpathway.io"] as const;

export function isHiddenFromRole(
  email: string | null | undefined,
  viewerRole: string
): boolean {
  if (viewerRole === "dev") return false;
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return HIDDEN_FROM_NON_DEV_EMAILS.some((h) => h.toLowerCase() === e);
}

/** Role `dev` is hidden even when a list forgot to check the email. */
export function isHiddenProfile(
  profile: { email?: string | null; role?: string | null },
  viewerRole: string
): boolean {
  if (viewerRole === "dev") return false;
  if (profile.role === "dev") return true;
  return isHiddenFromRole(profile.email, viewerRole);
}
