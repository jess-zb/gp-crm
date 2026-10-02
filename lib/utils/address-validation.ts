export function isPOBox(address: string | null | undefined): boolean {
  if (!address) return false;
  return (
    /\bp\.?\s*o\.?\s*box\b/i.test(address) ||
    /\bpost\s+office\s+box\b/i.test(address) ||
    /^p\.?\s*o\.?\s+\d/i.test(address.trim())
  );
}

export function getAddressWarning(
  address: string | null | undefined
): string | null {
  if (isPOBox(address)) {
    return "PO Box address — fix before sending";
  }
  if (!address?.trim()) {
    return "No address on file";
  }
  return null;
}
