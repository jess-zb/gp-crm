export type Carrier = "fedex" | "ups" | "usps" | "unknown";

export function detectCarrier(tracking: string): Carrier {
  if (!tracking) return "unknown";
  const t = tracking.trim().toUpperCase();

  // UPS: starts with 1Z
  if (t.startsWith("1Z")) return "ups";

  // USPS: 20-22 digits starting with 9, or specific prefixes
  if (/^(94|93|92|91|90)\d{18,20}$/.test(t)) return "usps";
  if (/^\d{20,22}$/.test(t)) return "usps";

  // FedEx: 12 digits, 15 digits, or 22 digits
  if (/^\d{12}$/.test(t)) return "fedex";
  if (/^\d{15}$/.test(t)) return "fedex";
  if (/^\d{22}$/.test(t)) return "fedex";
  if (/^[0-9]{18}$/.test(t)) return "fedex";

  // Default to fedex for other formats
  return "fedex";
}

export function getTrackingUrl(tracking: string): string {
  const carrier = detectCarrier(tracking);
  const t = encodeURIComponent(tracking.trim());

  switch (carrier) {
    case "ups":
      return `https://www.ups.com/track?tracknum=${t}`;
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case "fedex":
    default:
      return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  }
}

export function getCarrierLabel(tracking: string): string {
  const carrier = detectCarrier(tracking);
  switch (carrier) {
    case "ups":
      return "UPS";
    case "usps":
      return "USPS";
    case "fedex":
      return "FedEx";
    default:
      return "Track";
  }
}

export function getCarrierColor(tracking: string): string {
  const carrier = detectCarrier(tracking);
  switch (carrier) {
    case "ups":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "usps":
      return "text-blue-700 bg-blue-50 border-blue-200";
    case "fedex":
      return "text-purple-700 bg-purple-50 border-purple-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}
