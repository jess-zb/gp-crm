/**
 * One-time bulk creation list for the dev-only invite page.
 * Left empty on purpose: the Golden Pathway staff roster has not been provided.
 */
export const USERS_TO_CREATE: {
  email: string;
  full_name: string;
  role: "admin" | "acct_manager" | "attorney";
}[] = [];
