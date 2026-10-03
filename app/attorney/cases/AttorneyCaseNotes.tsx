import { Pin } from "lucide-react";
import { formatDateTimeOrDash } from "@/lib/utils/date";

export type AttorneyCaseNoteItem = {
  id: string;
  body: string;
  sentAt: string | null;
  authorName: string;
  isPinned: boolean;
};

export function AttorneyCaseNotes({ notes }: { notes: AttorneyCaseNoteItem[] }) {
  const sorted = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.sentAt ?? 0).getTime() - new Date(a.sentAt ?? 0).getTime();
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Notes
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          All notes logged on this client
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
          No notes yet.
        </p>
      ) : (
        <ul className="mt-5 max-h-[32rem] space-y-3 overflow-y-auto">
          {sorted.map((n) => (
            <li key={n.id}>
              <div
                className={`relative rounded-lg border p-3 ${
                  n.isPinned
                    ? "border-amber-300 bg-amber-50/80 dark:border-amber-700/60 dark:bg-amber-950/20"
                    : "border-slate-100 bg-slate-50/80 dark:border-[#2E2E2E] dark:bg-[#121212]/40"
                }`}
              >
                {n.isPinned ? (
                  <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    <Pin className="h-3 w-3 fill-current" aria-hidden />
                    Pinned
                  </span>
                ) : null}
                <p
                  className={`whitespace-pre-wrap break-words text-sm ${
                    n.isPinned
                      ? "pr-16 text-amber-900 dark:text-amber-100"
                      : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {n.body}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {n.authorName}
                  <span className="mx-1">·</span>
                  {formatDateTimeOrDash(n.sentAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
