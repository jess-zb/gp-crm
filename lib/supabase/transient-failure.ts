/** True when Auth/DB failed to answer — not "this person has no session". */
export function isTransientUpstreamFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("network") ||
    m.includes("abort") ||
    m.includes("failed to fetch") ||
    m.includes("fetch failed")
  );
}
