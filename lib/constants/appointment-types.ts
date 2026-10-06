export type AppointmentTypeColor = "green" | "red" | "yellow" | "blue";
export type AppointmentPipelineKind = "sales" | "service";

export type StageAppointmentTypeDef = {
  value: string;
  label: string;
  color: AppointmentTypeColor;
  pipeline: AppointmentPipelineKind;
};

export const APPOINTMENT_TYPES_BY_STAGE: Record<string, StageAppointmentTypeDef[]> = {
  lead: [
    { value: "pre_auth_appointment", label: "Pre-Auth Appointment", color: "green", pipeline: "sales" },
    { value: "charge_appointment", label: "Charge Appointment", color: "green", pipeline: "sales" },
    { value: "decline_appointment", label: "Decline Appointment", color: "yellow", pipeline: "sales" },
    { value: "pre_auth_attempt", label: "Pre-Auth Attempt", color: "red", pipeline: "sales" },
    { value: "charge_attempt", label: "Charge Attempt", color: "red", pipeline: "sales" },
    { value: "appointment_set", label: "Appointment Set", color: "green", pipeline: "sales" },
  ],

  account_manager: [
    { value: "pre_auth_appointment", label: "Pre-Auth Appointment", color: "green", pipeline: "sales" },
    { value: "charge_appointment", label: "Charge Appointment", color: "green", pipeline: "sales" },
    { value: "decline_appointment", label: "Decline Appointment", color: "yellow", pipeline: "sales" },
    { value: "pre_auth_attempt", label: "Pre-Auth Attempt", color: "red", pipeline: "sales" },
    { value: "charge_attempt", label: "Charge Attempt", color: "red", pipeline: "sales" },
    { value: "appointment_set", label: "Appointment Set", color: "green", pipeline: "sales" },
  ],

  retention: [
    { value: "retention_call", label: "Retention Call", color: "red", pipeline: "sales" },
    { value: "follow_up_attempt", label: "Follow Up Attempt", color: "red", pipeline: "sales" },
  ],

  client_services: [
    { value: "cs_intro_call", label: "CS Intro Call", color: "green", pipeline: "service" },
    { value: "poa_follow_up_call", label: "Welcome Packet Follow Up Call", color: "yellow", pipeline: "service" },
    { value: "follow_up_appointment", label: "Follow Up Appointment", color: "green", pipeline: "service" },
    { value: "follow_up_attempt", label: "Follow Up Attempt", color: "red", pipeline: "service" },
  ],

  awaiting_collection_letter: [
    { value: "check_in_30_day", label: "30-Day Check-In Call", color: "blue", pipeline: "service" },
    { value: "check_in_60_day", label: "60-Day Check-In Call", color: "blue", pipeline: "service" },
    { value: "check_in_90_day", label: "90-Day Check-In Call", color: "blue", pipeline: "service" },
    { value: "follow_up_attempt", label: "Follow Up Attempt", color: "red", pipeline: "service" },
  ],

  case_sent_to_attorneys: [
    {
      value: "case_sent_notification",
      label: "Case Sent Notification Call",
      color: "green",
      pipeline: "service",
    },
    { value: "follow_up_appointment", label: "Follow Up Appointment", color: "green", pipeline: "service" },
  ],
};

export function getAppointmentTypesForStage(stage: string): StageAppointmentTypeDef[] {
  return APPOINTMENT_TYPES_BY_STAGE[stage] ?? APPOINTMENT_TYPES_BY_STAGE.lead!;
}

const PILL_BY_COLOR: Record<AppointmentTypeColor, string> = {
  green: "bg-green-100 text-green-700 border-green-200",
  red: "bg-red-100 text-red-700 border-red-200",
  yellow: "bg-amber-100 text-amber-800 border-amber-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
};

export function getAppointmentPillClass(value: string): string {
  const allTypes = Object.values(APPOINTMENT_TYPES_BY_STAGE).flat();
  const found = allTypes.find((t) => t.value === value);
  const color: AppointmentTypeColor = found?.color ?? "blue";
  return PILL_BY_COLOR[color];
}

const ACRONYMS = new Set(["CS", "DNC", "DNQ"]);

function humanizeSnakeCase(value: string): string {
  return value
    .split("_")
    .map((word) => {
      if (word.toLowerCase() === "poa") return "Welcome Packet";
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Label for a stored appointment_type value. Falls back to a humanized form if unknown. */
export function getAppointmentTypeLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const allTypes = Object.values(APPOINTMENT_TYPES_BY_STAGE).flat();
  const found = allTypes.find((t) => t.value === value);
  return found?.label ?? humanizeSnakeCase(value);
}
