/**
 * Packet Manager must keep serving if carrier_status is not on the table yet
 * (preview skip, missing DATABASE_URL, or code ahead of SQL).
 */

export function isUndefinedColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  column: string
): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  if (!msg.toLowerCase().includes(column.toLowerCase())) return false;
  if (error.code === "42703") return true;
  return /does not exist/i.test(msg);
}

export function omitCarrierStatus<T extends { carrier_status?: unknown }>(
  row: T
): Omit<T, "carrier_status"> {
  const { carrier_status: _dropped, ...rest } = row;
  return rest;
}

type PgError = { code?: string | null; message?: string | null } | null;

export async function retryWriteWithoutCarrierStatus<R extends { error: PgError }>(
  withCarrier: () => PromiseLike<R>,
  withoutCarrier: () => PromiseLike<R>
): Promise<R> {
  const first = await withCarrier();
  if (!isUndefinedColumnError(first.error, "carrier_status")) return first;
  return withoutCarrier();
}
