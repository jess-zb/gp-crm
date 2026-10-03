/**
 * Canonical Golden Pathway client-facing contact information.
 * Import from here — never hardcode phone/email/brand in templates or dispatch code.
 *
 * BUSINESS_LEGAL_NAME is the entity string used in emails and PDF stamps.
 * The wordmark artwork still includes the word FINANCIAL; this constant does
 * not.
 */
export const BUSINESS_NAME = "Golden Pathway";
export const BUSINESS_LEGAL_NAME = "Golden Pathway";

export const SUPPORT_EMAIL = "support@goldenpathway.io";
export const FROM_EMAIL = `${BUSINESS_NAME} <${SUPPORT_EMAIL}>`;

export const SUPPORT_PHONE = "928-433-8408";
export const SUPPORT_PHONE_E164 = "+19284338408";

export const WEBSITE_URL = "https://www.goldenpathway.io";

/**
 * Production CRM origin used by every client-facing link when
 * `NEXT_PUBLIC_APP_URL` is unset. Placeholder until the Golden Pathway
 * deployment exists — update it there and nowhere else.
 */
export const DEFAULT_APP_URL = "https://golden-pathway-crm.example";

/** Client-facing CRM origin for emails and tokenized links. */
export function publicAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/$/, "");
}

/** Default email subjects for sequence templates (matches emails/*.tsx). */
export const EMAIL_SUBJECTS = {
  welcome_lead: `Welcome to ${BUSINESS_NAME}!`,
  welcome_cs: `Welcome to Your Next Step with ${BUSINESS_NAME}!`,
  follow_up_24hr: "We Missed You – Let's Reschedule Your Appointment",
  active_1: "Welcome—Here's What Happens Next",
  active_2: "Quick Check-In—We're Here for You",
  active_3: "Why You MUST Forward Creditor Mail",
  active_4: "One Month In—You're Doing Great!",
  active_5: "How to Stay Confident During Your Program",
  active_6: "Halfway Through—Keeping You on Track",
  active_7: `90 Days Strong—Thank You for Trusting ${BUSINESS_NAME}`,
  partial_1: "Let's Complete Your Enrollment Today",
  partial_2: "Your Enrollment Is Still Pending",
  partial_3: "Urgent: Last Step to Activate Your Program",
  partial_4: "Last Chance to Confirm Your Enrollment",
  case_referred: "Congrats! Your File Is Now with Our Attorney Network",
  holiday: "We're currently closed for the holidays",
} as const;

export type EmailSubjectKey = keyof typeof EMAIL_SUBJECTS;

/** Legacy Zero Balance patterns — used by scripts/check-business-contact.ts */
export const FORBIDDEN_CONTACT_PATTERNS: readonly RegExp[] = [
  /888[-.\s(]*805[-.\s)]*4221/i,
  /888[-.\s(]*807[-.\s)]*4221/i,
  /support@zerobalance\.info/i,
  /emile@zerobalance\.info/i,
  /alex@zerobalance\.info/i,
  /jessica@zerobalance\.info/i,
  /https?:\/\/zerobalance\.info/i,
  /app\.debtsupportpros\.com/i,
  /debtsupportpros\.com/i,
  /DebtSupportPros/i,
  /dspcrm\.vercel\.app/i,
  /zb-crm\.vercel\.app/i,
  /888[-.\s(]*885[-.\s)]*6042/i,
  /Welcome to Zero Balance/i,
  /Zero Balance Team/i,
  /with Zero Balance/i,
  /At Zero Balance/i,
  /Trusting Zero Balance/i,
];

/** Replace legacy ZB contact strings in free-form text (DB backfill / migrations). */
export function scrubLegacyContactText(text: string): string {
  let t = text;
  t = t.replace(/888[-.\s(]*805[-.\s)]*4221/gi, SUPPORT_PHONE);
  t = t.replace(/888[-.\s(]*807[-.\s)]*4221/gi, SUPPORT_PHONE);
  t = t.replace(/\(888\)\s*807-4221/gi, SUPPORT_PHONE);
  t = t.replace(/support@zerobalance\.info/gi, SUPPORT_EMAIL);
  t = t.replace(/emile@zerobalance\.info/gi, SUPPORT_EMAIL);
  t = t.replace(/https?:\/\/zerobalance\.info\/?/gi, WEBSITE_URL);
  t = t.replace(/Welcome to Zero Balance!/g, EMAIL_SUBJECTS.welcome_lead);
  t = t.replace(/Welcome to Your Next Step with Zero Balance!/g, EMAIL_SUBJECTS.welcome_cs);
  t = t.replace(/90 Days Strong—Thank You for Trusting Zero Balance/g, EMAIL_SUBJECTS.active_7);
  t = t.replace(/Welcome again to Zero Balance/g, `Welcome again to ${BUSINESS_NAME}`);
  t = t.replace(/At Zero Balance,/g, `At ${BUSINESS_NAME},`);
  t = t.replace(/with Zero Balance\./g, `with ${BUSINESS_NAME}.`);
  t = t.replace(/The Zero Balance Team/g, `The ${BUSINESS_NAME} Team`);
  t = t.replace(/Welcome to Zero Balance!/g, EMAIL_SUBJECTS.welcome_lead);
  return t;
}
