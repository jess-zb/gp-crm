/**
 * Turn database / infrastructure error text into plain language for end users.
 */
function extractMessage(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw instanceof Error) return raw.message.trim();
  if (raw !== null && typeof raw === "object" && "message" in raw) {
    const msg = (raw as { message: unknown }).message;
    if (typeof msg === "string") return msg.trim();
  }
  const s = String(raw).trim();
  if (s === "[object Object]") return "";
  return s;
}

export function toUserFacingError(raw: unknown): string {
  const m = extractMessage(raw);
  if (!m) return "Something went wrong. Please try again.";

  const lower = m.toLowerCase();

  if (
    lower.includes("row-level security") ||
    lower.includes("violates row-level security") ||
    (lower.includes("rls") && lower.includes("policy"))
  ) {
    return "You don't have permission to perform this action.";
  }
  if (lower.includes("permission denied for table")) {
    return "Access denied. Please contact your administrator.";
  }
  if (
    lower.includes("foreign key violation") ||
    lower.includes("violates foreign key constraint")
  ) {
    return "This record is linked to other data and cannot be deleted.";
  }
  if (
    lower.includes("duplicate key value") ||
    lower.includes("unique constraint")
  ) {
    return "This record already exists.";
  }
  if (lower.includes("jwt expired") || lower.includes("invalid jwt")) {
    return "Your session expired. Please sign in again.";
  }
  if (lower.includes("network") || lower.includes("fetch failed")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  if (
    lower.includes("postlogic") ||
    lower.includes("invalid json") ||
    lower.includes("returned invalid")
  ) {
    return "We couldn't complete the print request. Please try again or contact your administrator.";
  }
  if (
    lower.includes("violates check constraint") ||
    lower.includes("not null violation") ||
    lower.includes("invalid input syntax")
  ) {
    return "Something went wrong while saving. Please check your entries and try again.";
  }

  return m.length > 180 ? `${m.slice(0, 177)}…` : m;
}
