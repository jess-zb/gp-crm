import { parseLayoutFields, type EsignLayoutField } from "./layout";

/** Field placements live on the template row. */
export function layoutFromTemplate(fields: unknown): EsignLayoutField[] {
  return parseLayoutFields(fields) ?? [];
}
