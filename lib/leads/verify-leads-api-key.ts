import { createHash, timingSafeEqual } from "crypto";

/** Strip optional wrapping quotes from env values (common dashboard mistake). */
export function normalizeLeadsApiKey(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.length ? s : undefined;
}

function bearerToken(authHeader: string | null): string | null {
  if (authHeader == null) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
  return match?.[1] ?? null;
}

/** SHA-256 both sides so the compare does not depend on the secret's length. */
function secretsMatch(presented: string | null | undefined, secret: string): boolean {
  const left = createHash("sha256").update(presented ?? "").digest();
  const right = createHash("sha256").update(secret).digest();
  return timingSafeEqual(left, right);
}

export type LeadsApiKeyCheck = "ok" | "missing" | "unauthorized";

/**
 * Partner auth for POST /api/leads. Fails closed when LEADS_API_KEY is unset.
 * Accepts Authorization: Bearer or X-Api-Key. The key is never read from the URL.
 */
export function verifyLeadsApiKey(request: Request): LeadsApiKeyCheck {
  const secret = normalizeLeadsApiKey(process.env.LEADS_API_KEY);
  if (!secret) return "missing";

  const bearer = bearerToken(request.headers.get("authorization"));
  const header = request.headers.get("x-api-key")?.trim() || null;
  const bearerOk = secretsMatch(bearer, secret);
  const headerOk = secretsMatch(header, secret);
  return bearerOk || headerOk ? "ok" : "unauthorized";
}
