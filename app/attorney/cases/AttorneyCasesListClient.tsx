"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { AttorneyCaseRow } from "./page";
import { formatDate } from "@/lib/utils/date";

function formatCaseDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDate(d, { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  initialQ: string;
  cases: AttorneyCaseRow[];
};

export function AttorneyCasesListClient({ initialQ, cases }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [isPending, startTransition] = useTransition();

  const applySearch = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const t = next.trim();
      if (t) params.set("q", t);
      else params.delete("q");
      startTransition(() => {
        router.push(`/attorney/cases?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  return (
    <div className="mt-6">
      <form
        className="mb-6 flex max-w-md flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          applySearch(q);
        }}
      >
        <label className="sr-only" htmlFor="case-search">
          Search by client name
        </label>
        <input
          id="case-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-[#E8EAEE]"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[#8DE3B5] px-4 py-2 text-sm font-semibold text-[#0A2540] disabled:opacity-60"
        >
          Search
        </button>
      </form>

      {cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center dark:border-[#1a3550] dark:bg-[#0d2035]">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No cases assigned yet
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-[#1a3550]">
            <thead className="bg-slate-50 dark:bg-[#0d2035]/80">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                  Client Name
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                  Assigned
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1a3550]">
              {cases.map((c) => {
                const name =
                  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client";
                const assigned = c.attorney_portal_assigned_at;
                return (
                  <tr
                    key={c.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/attorney/cases/${c.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/attorney/cases/${c.id}`);
                      }
                    }}
                    className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-[#102840]/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatCaseDate(assigned)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/attorney/cases/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0A2540] shadow-sm hover:bg-slate-50 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-[#8DE3B5] dark:hover:bg-[#102840]"
                      >
                        View case
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
