/**
 * Vercel middleware must send a first byte within 25s or the request 504s
 * globally. Auth + profiles must finish well under that, or abort.
 *
 * Aborting is "we could not verify you in time" — not sign-out. Do not
 * clear cookies or redirect to /login on abort.
 */
export const MIDDLEWARE_AUTH_BUDGET_MS = 2_000;

export function createMiddlewareAuthBudget(budgetMs: number = MIDDLEWARE_AUTH_BUDGET_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);

  function fetchWithBudget(input: RequestInfo | URL, init?: RequestInit) {
    return fetch(input, { ...init, signal: controller.signal });
  }

  function skipCookieWrites(): boolean {
    return controller.signal.aborted;
  }

  function dispose() {
    clearTimeout(timer);
  }

  return { controller, fetchWithBudget, skipCookieWrites, dispose };
}
