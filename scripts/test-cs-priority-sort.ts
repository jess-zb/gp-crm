/**
 * Sort rules for the Priority board. Run with `npx tsx scripts/test-cs-priority-sort.ts`.
 *
 * The board is the only place these orderings are visible, and a comparator
 * that silently disagrees with the header arrow is hard to spot by eye, so the
 * rules are pinned here instead.
 */
import {
  defaultDirFor,
  sortPriorityRows,
  type PrioritySortField,
  type SortableBoardRow,
} from "@/lib/clients/cs-priority-sort";
import { CS_CHECKLIST_ITEMS } from "@/lib/clients/cs-checklist";

type Row = SortableBoardRow & { id: string };

function row(
  id: string,
  opts: {
    name?: string;
    days?: number | null;
    done?: boolean[];
    enteredDaysAgo?: number | null;
  } = {}
): Row {
  const done = opts.done ?? [false, false, false, false];
  const states = CS_CHECKLIST_ITEMS.map((item, i) => ({
    key: item.key,
    label: item.label,
    complete: done[i] ?? false,
    autoChecked: false,
    manualChecked: done[i] ?? false,
    bypassed: false,
  }));
  const completeCount = done.filter(Boolean).length;
  const entered =
    opts.enteredDaysAgo === undefined
      ? opts.days ?? null
      : opts.enteredDaysAgo;

  return {
    id,
    displayName: opts.name ?? id,
    stage_entered_at:
      entered === null
        ? null
        : new Date(Date.now() - entered * 86_400_000).toISOString(),
    daysInStage: opts.days === undefined ? entered : opts.days,
    completeCount,
    incompleteCount: states.length - completeCount,
    states,
  } as Row;
}

let failures = 0;

function check(label: string, actual: string[], expected: string[]) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got      ${actual.join(", ")}\n      expected ${expected.join(", ")}`}`
  );
}

function ids(rows: Row[], field: PrioritySortField, dir?: "asc" | "desc") {
  return sortPriorityRows(rows, field, dir ?? defaultDirFor(field)).map(
    (r) => r.id
  );
}

async function main() {
  const itemKey = CS_CHECKLIST_ITEMS[0].key;

  // Default order: most outstanding, then longest waiting, then name.
  const urgency = [
    row("done-3", { done: [true, true, true, false], days: 90 }),
    row("fresh-0", { done: [false, false, false, false], days: 1 }),
    row("stale-0", { done: [false, false, false, false], days: 40 }),
  ];
  check("priority puts most outstanding first, oldest breaking the tie", ids(urgency, "priority"), [
    "stale-0",
    "fresh-0",
    "done-3",
  ]);

  // A column click must not leave two arbitrary heaps: within each half the
  // rows stay in priority order.
  const split = [
    row("a-ticked-fresh", { done: [true, false, false, false], days: 2 }),
    row("b-open-fresh", { done: [false, false, false, false], days: 3 }),
    row("c-open-stale", { done: [false, false, false, false], days: 50 }),
    row("d-ticked-stale", { done: [true, true, false, false], days: 60 }),
  ];
  check(
    "item column: outstanding first, priority order within each group",
    ids(split, `item:${itemKey}`),
    ["c-open-stale", "b-open-fresh", "a-ticked-fresh", "d-ticked-stale"]
  );
  check(
    "item column reversed: complete first",
    ids(split, `item:${itemKey}`, "desc"),
    ["a-ticked-fresh", "d-ticked-stale", "c-open-stale", "b-open-fresh"]
  );

  const byName = [row("c", { name: "Carla" }), row("a", { name: "Ana" }), row("b", { name: "Bo" })];
  check("name sorts A–Z", ids(byName, "name"), ["a", "b", "c"]);
  check("name reversed sorts Z–A", ids(byName, "name", "desc"), ["c", "b", "a"]);

  const byDone = [
    row("two", { done: [true, true, false, false] }),
    row("none", { done: [false, false, false, false] }),
    row("one", { done: [true, false, false, false] }),
  ];
  check("done sorts fewest first", ids(byDone, "done"), ["none", "one", "two"]);

  // A client with no stage date should not masquerade as the newest arrival.
  const byDays = [
    row("unknown", { days: null, enteredDaysAgo: null }),
    row("old", { days: 30 }),
    row("new", { days: 2 }),
  ];
  check("days: longest first, unknown last", ids(byDays, "days"), [
    "old",
    "new",
    "unknown",
  ]);
  check("days reversed: newest first, unknown still last", ids(byDays, "days", "asc"), [
    "new",
    "old",
    "unknown",
  ]);

  // Sorting must not mutate what the caller handed over.
  const original = [row("z"), row("y")];
  const snapshot = original.map((r) => r.id);
  sortPriorityRows(original, "name", "asc");
  check("sorting leaves the input array alone", original.map((r) => r.id), snapshot);

  console.log(failures === 0 ? "\nAll sort rules hold." : `\n${failures} failing.`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
