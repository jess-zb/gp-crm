import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function createSignToken(): string {
  return randomBytes(24).toString("base64url");
}

export function createOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function otpMatches(code: string, hash: string | null): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashOtp(code));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signLinkExpiresAt(days = 14): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
