const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when an address can receive CRM / Resend mail. */
export function isDeliverableEmail(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const s = raw.trim().toLowerCase();
  if (!s || !EMAIL_RE.test(s)) return false;
  if (s.endsWith("@noemail.com") || s.endsWith("@example.com")) return false;
  return true;
}
