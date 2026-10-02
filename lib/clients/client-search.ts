/** Normalize whitespace and casing for name/email search. */
export function normalizeStr(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type ClientSearchMatchInput = {
  first_name: string | null;
  last_name: string | null;
  nickname?: string | null;
  secondary_first_name?: string | null;
  secondary_last_name?: string | null;
  spouse_first_name?: string | null;
  spouse_last_name?: string | null;
  spouse_name?: string | null;
  email: string | null;
  phone_mobile: string | null;
  phone?: string | null;
  phone_work?: string | null;
  phone_home?: string | null;
  city?: string | null;
  zip_code?: string | null;
  street_address?: string | null;
};

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

function escapeIlikeToken(raw: string): string {
  // Commas and parentheses are PostgREST logic-tree syntax chars — strip them so they
  // don't break the .or() filter string (e.g. searching "(310) 697-9049" would otherwise
  // cause "failed to parse logic tree" because PostgREST treats ( ) as group delimiters).
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/[,()]/g, "");
}

/**
 * Client-side filter: full-name phrases ("John Smith"), reversed order, spouse/secondary,
 * phones (substring + digit match), email, tracking, city, ZIP.
 */
export function searchFilter(client: ClientSearchMatchInput, query: string): boolean {
  if (!query.trim()) return true;

  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);

  const primaryFull = [client.first_name, client.last_name].filter(Boolean).join(" ").toLowerCase();

  const primaryReversed = [client.last_name, client.first_name].filter(Boolean).join(" ").toLowerCase();

  const secondaryFull = [
    client.spouse_first_name || client.secondary_first_name,
    client.spouse_last_name || client.secondary_last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const secondaryReversed = [
    client.spouse_last_name || client.secondary_last_name,
    client.spouse_first_name || client.secondary_first_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const phoneBlob = digits(
    [
      client.phone_mobile,
      client.phone,
      client.phone_work,
      client.phone_home,
    ]
      .filter(Boolean)
      .join("") || ""
  );

  const searchableFields = [
    primaryFull,
    primaryReversed,
    secondaryFull,
    secondaryReversed,
    client.email,
    client.phone_mobile,
    client.phone_home,
    client.phone_work,
    client.phone,
    client.city,
    client.zip_code,
    client.nickname,
    client.street_address,
    normalizeStr(client.spouse_name || ""),
  ]
    .filter(Boolean)
    .map((f) => String(f).toLowerCase());

  const wordMatchesFields = (word: string): boolean => {
    const d = digits(word);
    if (d.length >= 3 && phoneBlob.includes(d)) return true;
    return searchableFields.some((f) => f.includes(word));
  };

  if (words.length === 1) {
    return wordMatchesFields(words[0]!);
  }

  const fullMatch = searchableFields.some((f) => f.includes(q));
  if (fullMatch) return true;

  return words.every((word) => wordMatchesFields(word));
}

/**
 * PostgREST `.or(...)` fragment for `clients` search (comma-separated OR / and() groups).
 */
export function buildSearchQuery(q: string): string {
  const trimmed = q.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  if (words.length === 1) {
    const w = escapeIlikeToken(words[0]!);
    const p = `%${w}%`;
    return [
      `first_name.ilike.${p}`,
      `last_name.ilike.${p}`,
      `nickname.ilike.${p}`,
      `phone_mobile.ilike.${p}`,
      `email.ilike.${p}`,
      `spouse_first_name.ilike.${p}`,
      `spouse_last_name.ilike.${p}`,
      `secondary_first_name.ilike.${p}`,
      `phone.ilike.${p}`,
      `phone_work.ilike.${p}`,
      `phone_home.ilike.${p}`,
      `city.ilike.${p}`,
      `zip_code.ilike.${p}`,
      `street_address.ilike.${p}`,
    ].join(",");
  }

  const w1 = escapeIlikeToken(words[0]!);
  const w2 = escapeIlikeToken(words[1]!);
  const p1 = `%${w1}%`;
  const p2 = `%${w2}%`;
  // Join escaped words with % so "(310) 697-9049" → "%310%697-9049%" which still
  // matches the DB value "(310) 697-9049" as a wildcard substring.
  const pFull = `%${words.map((w) => escapeIlikeToken(w)).join("%")}%`;

  const parts: string[] = [
    `and(first_name.ilike.${p1},last_name.ilike.${p2})`,
    `and(first_name.ilike.${p2},last_name.ilike.${p1})`,
    `and(spouse_first_name.ilike.${p1},spouse_last_name.ilike.${p2})`,
    `and(spouse_first_name.ilike.${p2},spouse_last_name.ilike.${p1})`,
    `phone_mobile.ilike.${pFull}`,
    `email.ilike.${pFull}`,
  ];

  if (words.length > 2) {
    const fuzzy = escapeIlikeToken(words.join("%"));
    const pf = `%${fuzzy}%`;
    parts.push(
      `first_name.ilike.${pf}`,
      `last_name.ilike.${pf}`,
      `nickname.ilike.${pf}`,
      `email.ilike.${pf}`
    );
  }

  return parts.join(",");
}

/**
 * @deprecated Prefer {@link searchFilter} — kept for callers that already use this name.
 */
export function matchesSearch(client: ClientSearchMatchInput, query: string): boolean {
  return searchFilter(client, query);
}
