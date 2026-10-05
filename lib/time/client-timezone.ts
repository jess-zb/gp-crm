import { normalizeUsState } from "@/lib/leads/us-states";

export type ClientTimeZone = {
  timeZone: string;
  label: string;
};

const EASTERN = "America/New_York";
const CENTRAL = "America/Chicago";
const MOUNTAIN = "America/Denver";
const ARIZONA = "America/Phoenix";
const PACIFIC = "America/Los_Angeles";
const ALASKA = "America/Anchorage";
const HAWAII = "Pacific/Honolulu";

/** Most-used clock for each state. ZIP prefixes below correct the states that keep two. */
const STATE_ZONE: Record<string, string> = {
  AL: CENTRAL,
  AK: ALASKA,
  AZ: ARIZONA,
  AR: CENTRAL,
  CA: PACIFIC,
  CO: MOUNTAIN,
  CT: EASTERN,
  DE: EASTERN,
  DC: EASTERN,
  FL: EASTERN,
  GA: EASTERN,
  HI: HAWAII,
  ID: MOUNTAIN,
  IL: CENTRAL,
  IN: EASTERN,
  IA: CENTRAL,
  KS: CENTRAL,
  KY: EASTERN,
  LA: CENTRAL,
  ME: EASTERN,
  MD: EASTERN,
  MA: EASTERN,
  MI: EASTERN,
  MN: CENTRAL,
  MS: CENTRAL,
  MO: CENTRAL,
  MT: MOUNTAIN,
  NE: CENTRAL,
  NV: PACIFIC,
  NH: EASTERN,
  NJ: EASTERN,
  NM: MOUNTAIN,
  NY: EASTERN,
  NC: EASTERN,
  ND: CENTRAL,
  OH: EASTERN,
  OK: CENTRAL,
  OR: PACIFIC,
  PA: EASTERN,
  RI: EASTERN,
  SC: EASTERN,
  SD: CENTRAL,
  TN: CENTRAL,
  TX: CENTRAL,
  UT: MOUNTAIN,
  VT: EASTERN,
  VA: EASTERN,
  WA: PACIFIC,
  WV: EASTERN,
  WI: CENTRAL,
  WY: MOUNTAIN,
};

const ZONE_LABEL: Record<string, string> = {
  [EASTERN]: "Eastern",
  [CENTRAL]: "Central",
  [MOUNTAIN]: "Mountain",
  [ARIZONA]: "Arizona",
  [PACIFIC]: "Pacific",
  [ALASKA]: "Alaska",
  [HAWAII]: "Hawaii",
};

function zip3(zip: string | null | undefined): string | null {
  const digits = (zip ?? "").replace(/\D/g, "");
  return digits.length >= 3 ? digits.slice(0, 3) : null;
}

function inList(code: string | null, prefixes: string[]): boolean {
  return code != null && prefixes.includes(code);
}

/** ZIP prefixes that do not follow the state's main clock. */
function zoneOverride(state: string, zip: string | null | undefined): string | null {
  const prefix = zip3(zip);
  if (!prefix) return null;
  switch (state) {
    case "AZ":
      return inList(prefix, ["860", "865"]) ? MOUNTAIN : null;
    case "FL":
      return inList(prefix, ["324", "325"]) ? CENTRAL : null;
    case "TX":
      return inList(prefix, ["798", "799", "885"]) ? MOUNTAIN : null;
    case "IN":
      return inList(prefix, ["463", "464"]) ? CENTRAL : null;
    case "KY":
      return inList(prefix, ["420", "421", "422", "423", "424"]) ? CENTRAL : null;
    case "TN":
      return inList(prefix, ["376", "377", "378", "379"]) ? EASTERN : null;
    case "MI":
      return inList(prefix, ["498", "499"]) ? CENTRAL : null;
    case "ND":
      return inList(prefix, ["586", "587", "588"]) ? MOUNTAIN : null;
    case "SD":
      return prefix === "577" ? MOUNTAIN : null;
    case "NE":
      return prefix === "693" ? MOUNTAIN : null;
    case "KS":
      return inList(prefix, ["677", "678", "679"]) ? MOUNTAIN : null;
    case "OR":
      return prefix === "979" ? MOUNTAIN : null;
    case "ID":
      return inList(prefix, ["835", "838"]) ? PACIFIC : null;
    case "NV":
      return prefix === "898" ? MOUNTAIN : null;
    default:
      return null;
  }
}

/** The client's clock from their state, using ZIP when that state has two. */
export function timeZoneForClient(
  state: string | null | undefined,
  zip?: string | null
): ClientTimeZone | null {
  const code = normalizeUsState(state ?? "");
  if (!code) return null;
  const timeZone = zoneOverride(code, zip) ?? STATE_ZONE[code];
  if (!timeZone) return null;
  return { timeZone, label: ZONE_LABEL[timeZone] ?? timeZone };
}
