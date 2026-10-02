/** 32 random bytes as hex (64 chars), from `randomBytes(32).toString("hex")`). */
export const PORTAL_INVITE_TOKEN_HEX_LENGTH = 64;

export function isHexPortalInviteToken(token: string): boolean {
  return (
    token.length === PORTAL_INVITE_TOKEN_HEX_LENGTH &&
    /^[0-9a-f]{64}$/i.test(token)
  );
}
