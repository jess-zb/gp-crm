import { timingSafeEqual } from "crypto";

/**
 * Vercel Cron: when `CRON_SECRET` is set on the project, Vercel sends
 * `Authorization: Bearer <CRON_SECRET>` on invocations.
 * @see https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-secret
 */
function bearerTokenFromAuthorizationHeader(authHeader: string | null): string | null {
  if (authHeader == null) return null;
  const trimmed = authHeader.trim();
  const m = /^Bearer\s+(\S.*)$/i.exec(trimmed);
  return m?.[1]?.trim() ?? null;
}

/** Strip optional wrapping quotes from env values (common dashboard mistake). */
export function normalizeCronSecret(raw: string | undefined): string | undefined {
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

/** Constant-time string compare to avoid leaking secret length/prefix via timing. */
function secretsMatch(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function verifyVercelCronRequest(request: Request): boolean {
  const cronSecret = normalizeCronSecret(process.env.CRON_SECRET);
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  const token = bearerTokenFromAuthorizationHeader(authHeader);
  return secretsMatch(token, cronSecret);
}

/**
 * Cron auth accepting EITHER the Vercel `Authorization: Bearer <CRON_SECRET>`
 * token OR an explicit `x-cron-secret` header (for manual/external triggers).
 * Both are compared, constant-time, against the normalized CRON_SECRET, and it
 * fails closed when CRON_SECRET is unset. Use this for routes that allow a
 * manual trigger; use `verifyVercelCronRequest` for Vercel-cron-only routes.
 */
export function verifyCronRequest(request: Request): boolean {
  if (verifyVercelCronRequest(request)) return true;
  const cronSecret = normalizeCronSecret(process.env.CRON_SECRET);
  if (!cronSecret) return false;
  return secretsMatch(request.headers.get("x-cron-secret")?.trim(), cronSecret);
}
