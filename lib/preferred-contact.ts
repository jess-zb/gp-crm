/** Stored on `clients.preferred_contact` (TEXT). Legacy rows may use `sms`. */
export type PreferredContactUi = "call" | "text" | "email";

export function preferredContactForUi(db: string | null | undefined): PreferredContactUi {
  const p = (db ?? "email").trim().toLowerCase();
  if (p === "sms") return "text";
  if (p === "call" || p === "text") return p;
  return "email";
}

/** Persist call | text | email (maps legacy sms → text). */
export function normalizePreferredContactForDb(raw: string): PreferredContactUi {
  const p = raw.trim().toLowerCase();
  if (p === "sms") return "text";
  if (p === "call" || p === "text" || p === "email") return p;
  return "email";
}
