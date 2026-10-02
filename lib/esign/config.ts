import { isDev } from "@/lib/roles";
import type { EsignKind } from "./types";

/**
 * Kill switch. Staff UI is still Dev-only via `canUseEsignStaffUi`.
 * Unset means on so production works without a forgotten env var.
 */
export function isEsignFeatureEnabled(): boolean {
  const native = process.env.ESIGN_ENABLED?.trim().toLowerCase();
  const legacy = process.env.OPENSIGN_ESIGN_ENABLED?.trim().toLowerCase();
  if (native === "false" || legacy === "false") return false;
  return true;
}

/**
 * Who can see and send eSign from a client profile.
 * Role `dev` always can. Named admins are a temporary pilot — not every admin.
 * Place fields stays Dev via `canPlaceEsignFields`.
 */
export const ESIGN_STAFF_ROLES = ["dev"] as const;

export const ESIGN_PILOT_EMAILS = [
  "dev@debtsupportpros.com",
  "cs@debtsupportpros.com",
  "jessica@debtsupportpros.com",
  "daniel@stellari.io",
  "amanda@stellari.io",
  "asim@voxtrongroup.com",
] as const;

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function canUseEsignStaffUi(
  role: string | null | undefined,
  email?: string | null
): boolean {
  if (isDev(role ?? "")) return true;
  const key = normalizeEmail(email);
  return (ESIGN_PILOT_EMAILS as readonly string[]).includes(key);
}

export function canPlaceEsignFields(role: string | null | undefined): boolean {
  return isDev(role ?? "");
}

export function opensignApiBase(): string {
  return (
    process.env.OPENSIGN_API_BASE?.trim() ||
    "https://sandbox.opensignlabs.com/api/v1.2"
  ).replace(/\/$/, "");
}

export function opensignApiToken(): string {
  return process.env.OPENSIGN_API_TOKEN?.trim() ?? "";
}

export function opensignWebhookSecret(): string {
  return process.env.OPENSIGN_WEBHOOK_SECRET?.trim() ?? "";
}

export function templateIdForKind(kind: EsignKind): string {
  if (kind === "welcome_packet") {
    return process.env.OPENSIGN_TEMPLATE_WELCOME_PACKET?.trim() ?? "";
  }
  if (kind === "cc_authorization") {
    return process.env.OPENSIGN_TEMPLATE_CC_AUTH?.trim() ?? "";
  }
  return "";
}
