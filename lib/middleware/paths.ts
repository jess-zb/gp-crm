/** Path helpers for the Vercel edge middleware matcher. */

export function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Tokenized / public routes. Must not wait on Auth — they are usable
 * without a CRM session.
 */
export function isMiddlewarePublicPath(pathname: string): boolean {
  return (
    matchesPath(pathname, "/attorney-batch") ||
    matchesPath(pathname, "/api/attorney-batch") ||
    matchesPath(pathname, "/sign") ||
    matchesPath(pathname, "/api/sign")
  );
}

export function isMiddlewareStaticPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)
  );
}
