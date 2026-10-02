export const CANCEL_REASONS = [
  {
    value: "charged_back",
    label: "Charged Back",
    description: "Client initiated chargeback",
  },
  {
    value: "dnq",
    label: "DNQ — Did Not Qualify",
    description: "Client does not meet criteria",
  },
  {
    value: "dnc",
    label: "DNC — Do Not Contact",
    description: "Client requested no contact",
  },
  {
    value: "not_interested",
    label: "Not Interested",
    description: "Client chose not to continue",
  },
  {
    value: "refund",
    label: "Refund Requested",
    description: "Client requested refund",
  },
] as const;

export type CancelReasonValue = (typeof CANCEL_REASONS)[number]["value"];

export function getCancelReasonLabel(value: string): string {
  return (
    CANCEL_REASONS.find((r) => r.value === value)?.label ?? value
  );
}

/** Maps final cancellation reason → client row update (no `cancelled` stage in schema). */
export function resolveClientCancelUpdate(reason: CancelReasonValue): {
  stage: string;
  is_active: boolean;
  dnc_reason: string | null;
} {
  switch (reason) {
    case "charged_back":
      return { stage: "dnc", is_active: false, dnc_reason: "chargeback" };
    case "dnq":
      return { stage: "dnq", is_active: false, dnc_reason: null };
    case "dnc":
      return { stage: "dnc", is_active: false, dnc_reason: "dnc" };
    case "not_interested":
      return { stage: "not_interested", is_active: false, dnc_reason: null };
    case "refund":
      return { stage: "dnc", is_active: false, dnc_reason: "refund" };
    default:
      return { stage: "dnc", is_active: false, dnc_reason: "cancelled" };
  }
}
