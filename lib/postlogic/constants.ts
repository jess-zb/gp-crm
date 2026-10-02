export const POSTLOGIC_INTAKE_URL =
  "https://mgapepreyainffkvezjc.supabase.co/functions/v1/intake";

export const POSTLOGIC_PARTNER = "DebtSupportPros, LLC";

/** Prefer POSTLOGIC_X_API_KEY in env; falls back to the known portal key. */
export function getPostlogicXApiKey(): string {
  const key = process.env.POSTLOGIC_X_API_KEY?.trim() || process.env.POSTLOGIC_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing POSTLOGIC_X_API_KEY or POSTLOGIC_API_KEY");
  }
  return key;
}

