/**
 * API paths attorneys may hit outside `/attorney/*`.
 *
 * Middleware redirects attorneys to `/attorney/cases` for every other path.
 * Portal Download / Preview use `/api/clients/documents/download` via an
 * `<a href>` / fetch — if this allowlist drops that route, attorneys bounce
 * back to Cases instead of receiving the file.
 *
 * Keep in sync with middleware.ts. Do not remove without replacing the
 * download mechanism.
 */
export const ATTORNEY_PORTAL_API_ALLOWLIST = [
  "/api/clients/documents/download",
] as const;

export type AttorneyPortalApiPath =
  (typeof ATTORNEY_PORTAL_API_ALLOWLIST)[number];

export function isAttorneyPortalApiPath(pathname: string): boolean {
  return ATTORNEY_PORTAL_API_ALLOWLIST.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
