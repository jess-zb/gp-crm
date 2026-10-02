import type { CsChecklistItemKey, CsItemState } from "@/lib/clients/cs-checklist";

/**
 * Sorting for the Priority board.
 *
 * Structural rather than tied to `PriorityBoardRow` so the board's client
 * component can import the comparators without dragging the server query in
 * with them.
 */
export type SortableBoardRow = {
  displayName: string;
  stage_entered_at: string | null;
  daysInStage: number | null;
  completeCount: number;
  incompleteCount: number;
  states: CsItemState[];
};

/** `item:<key>` sorts by one checklist column. */
export type PrioritySortField =
  | "priority"
  | "name"
  | "done"
  | "days"
  | `item:${CsChecklistItemKey}`;

export type PrioritySortDir = "asc" | "desc";

/**
 * The direction a column takes on its first click — whichever end of it people
 * actually came to look at. Clicking again reverses it.
 */
export const PRIORITY_SORT_DEFAULT_DIR: Record<
  Exclude<PrioritySortField, `item:${string}`> | "item",
  PrioritySortDir
> = {
  priority: "desc",
  name: "asc",
  // Fewest ticked and longest waiting are the ones needing attention.
  done: "asc",
  days: "desc",
  item: "asc",
};

export function defaultDirFor(field: PrioritySortField): PrioritySortDir {
  if (field.startsWith("item:")) return PRIORITY_SORT_DEFAULT_DIR.item;
  return PRIORITY_SORT_DEFAULT_DIR[
    field as Exclude<PrioritySortField, `item:${string}`>
  ];
}

function timeOf(iso: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * The board's own idea of urgency: most outstanding first, then whoever has
 * been waiting in the stage longest, then by name so equal rows never shuffle
 * between renders.
 *
 * Also the tie-break under every other column, which is what stops a sort by,
 * say, "CS Intro" from leaving two arbitrary heaps either side of the split.
 */
export function comparePriority(a: SortableBoardRow, b: SortableBoardRow): number {
  if (b.incompleteCount !== a.incompleteCount) {
    return b.incompleteCount - a.incompleteCount;
  }
  const at = timeOf(a.stage_entered_at);
  const bt = timeOf(b.stage_entered_at);
  if (at !== bt) return at - bt;
  return a.displayName.localeCompare(b.displayName);
}

/**
 * A row the column has no value for. Handled outside the ascending/descending
 * flip so a client with no stage date sorts last either way, rather than
 * riding to the top the moment the arrow is reversed.
 */
function isMissing(field: PrioritySortField, row: SortableBoardRow): boolean {
  return field === "days" && row.daysInStage === null;
}

function compareField(
  field: PrioritySortField,
  a: SortableBoardRow,
  b: SortableBoardRow
): number {
  if (field.startsWith("item:")) {
    const key = field.slice("item:".length) as CsChecklistItemKey;
    const aDone = a.states.find((s) => s.key === key)?.complete ? 1 : 0;
    const bDone = b.states.find((s) => s.key === key)?.complete ? 1 : 0;
    return aDone - bDone;
  }

  switch (field) {
    case "name":
      return a.displayName.localeCompare(b.displayName);
    case "done":
      return a.completeCount - b.completeCount;
    case "days":
      // Missing values were dealt with before this ran.
      return (a.daysInStage ?? 0) - (b.daysInStage ?? 0);
    default:
      return 0;
  }
}

/**
 * Returns a new array; the caller's order is left alone. "priority" ignores
 * direction in the sense that it has its own built-in ordering, which `desc`
 * expresses — `asc` simply reads it backwards, for the rare "who is closest to
 * done" pass.
 */
export function sortPriorityRows<T extends SortableBoardRow>(
  rows: readonly T[],
  field: PrioritySortField,
  dir: PrioritySortDir
): T[] {
  const sign = dir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (field === "priority") return sign * -comparePriority(a, b);

    const aMissing = isMissing(field, a);
    const bMissing = isMissing(field, b);
    if (aMissing !== bMissing) return aMissing ? 1 : -1;

    const primary = compareField(field, a, b);
    if (primary !== 0) return sign * primary;

    // Equal on the chosen column, so fall back to urgency rather than to
    // whatever order the rows happened to arrive in.
    return comparePriority(a, b);
  });
}
