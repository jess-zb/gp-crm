/** USD from cents — identical on server and client (no locale hydration issues). */
export function formatMoneyUsdFromCents(cents: number | null | undefined): string {
  const n = (cents ?? 0) / 100;
  const negative = n < 0;
  const abs = Math.abs(n);
  const s = abs.toFixed(2);
  const [intPart, dec] = s.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${withCommas}.${dec ?? "00"}`;
}
