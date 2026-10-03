import { formatUsd } from "./money";

export type EsignClientPrefill = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  dateOfBirth: string;
  spouseName: string;
  /** One-line mailing address. Filled from street, city, state, and ZIP. */
  address: string;
  /** "City, ST ZIP". Filled from those three parts. */
  cityStateZip: string;
  advisor: string;
  mid: string;
  amountAuthorized: string;
  card1Last4: string;
  card1Amount: string;
  card2Last4: string;
  card2Amount: string;
  card3Last4: string;
  card3Amount: string;
  card4Last4: string;
  card4Amount: string;
  card5Last4: string;
  card5Amount: string;
};

export function signerDisplayName(client: EsignClientPrefill): string {
  return `${client.firstName} ${client.lastName}`.trim();
}

export function formatCityStateZip(client: {
  city: string;
  state: string;
  zip: string;
}): string {
  const city = client.city.trim();
  const state = client.state.trim();
  const zip = client.zip.trim();
  const tail = [state, zip].filter(Boolean).join(" ");
  return [city, tail].filter(Boolean).join(", ");
}

/** "1 Main St, Austin, TX 78701" */
export function formatFullAddress(client: {
  street: string;
  city: string;
  state: string;
  zip: string;
}): string {
  const street = client.street.trim();
  const cityLine = formatCityStateZip(client);
  return [street, cityLine].filter(Boolean).join(", ");
}

function fullAddress(client: EsignClientPrefill): string {
  return formatFullAddress(client);
}

function norm(name: string): string {
  return name.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/** Map an OpenSign widget name to a CRM value. Unknown names stay empty. */
export function valueForWidgetName(
  widgetName: string,
  client: EsignClientPrefill
): string {
  const key = norm(widgetName);
  const name = signerDisplayName(client);
  const address = fullAddress(client);

  if (["name", "full name", "fullname", "client name", "signer name"].includes(key)) {
    return name;
  }
  if (["first name", "firstname", "fname", "given name"].includes(key)) {
    return client.firstName;
  }
  if (["last name", "lastname", "lname", "surname", "family name"].includes(key)) {
    return client.lastName;
  }
  if (["email", "e mail", "email address"].includes(key)) {
    return client.email;
  }
  if (["phone", "mobile", "cell", "telephone", "phone number", "phone mobile"].includes(key)) {
    return client.phone;
  }
  if (["address", "street", "street address", "mailing address"].includes(key)) {
    return client.street || address;
  }
  if (key === "city") return client.city;
  if (["state", "st"].includes(key)) return client.state;
  if (["zip", "zip code", "postal", "postal code"].includes(key)) return client.zip;
  if (["city state zip", "city/state/zip"].includes(key)) {
    return [client.city, client.state, client.zip].filter(Boolean).join(", ");
  }
  if (["date of birth", "dob", "birthdate", "birth date"].includes(key)) {
    return client.dateOfBirth;
  }
  if (key === "date" || key === "today" || key === "signing date" || key.startsWith("date ")) {
    return new Date().toLocaleDateString("en-US");
  }
  if (["spouse", "spouse name", "secondary name"].includes(key)) {
    return client.spouseName;
  }
  if (["advisor", "account manager", "am"].includes(key)) return client.advisor;
  if (["mid", "merchant", "merchant id"].includes(key)) return client.mid;
  if (["amount authorized", "authorized amount", "total amount"].includes(key)) {
    return formatUsd(client.amountAuthorized);
  }
  if (["card 1 last #", "card 1 last 4", "card1 last 4"].includes(key)) {
    return client.card1Last4;
  }
  if (["card 1 amount", "card1 amount"].includes(key)) return formatUsd(client.card1Amount);
  if (["card 2 last #", "card 2 last 4", "card2 last 4"].includes(key)) {
    return client.card2Last4;
  }
  if (["card 2 amount", "card2 amount"].includes(key)) return formatUsd(client.card2Amount);
  if (["card 3 last #", "card 3 last 4", "card3 last 4"].includes(key)) {
    return client.card3Last4;
  }
  if (["card 3 amount", "card3 amount"].includes(key)) return formatUsd(client.card3Amount);
  if (["card 4 last #", "card 4 last 4", "card4 last 4"].includes(key)) {
    return client.card4Last4;
  }
  if (["card 4 amount", "card4 amount"].includes(key)) return formatUsd(client.card4Amount);
  if (["card 5 last #", "card 5 last 4", "card5 last 4"].includes(key)) {
    return client.card5Last4;
  }
  if (["card 5 amount", "card5 amount"].includes(key)) return formatUsd(client.card5Amount);
  if (key === "textbox" || key.startsWith("textbox")) return address;
  return "";
}

const SKIP_WIDGET_TYPES = new Set(["signature", "stamp", "initials", "image", "initial"]);

export function shouldPrefillWidgetType(type: string | undefined): boolean {
  if (!type) return true;
  return !SKIP_WIDGET_TYPES.has(type.trim().toLowerCase());
}
