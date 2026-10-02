const CARRIER_CONFIG: Record<string, { label: string; className: string }> = {
  fedex: {
    label: "FedEx",
    className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  },
  ups: {
    label: "UPS",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  usps: {
    label: "USPS",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  other: {
    label: "Other",
    className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",
  },
};

export function CarrierBadge({ carrier }: { carrier: string }) {
  const key = (carrier || "other").toLowerCase();
  const config = CARRIER_CONFIG[key] ?? CARRIER_CONFIG.other;
  return (
    <span
      className={`rounded border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export function getShipmentTrackingUrl(tracking: string, carrier: string): string {
  const c = (carrier || "fedex").toLowerCase();
  const t = encodeURIComponent(tracking.trim());
  if (c === "ups") return `https://www.ups.com/track?tracknum=${t}`;
  if (c === "usps")
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
  return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
}
