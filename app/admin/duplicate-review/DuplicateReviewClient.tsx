"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { StagePill } from "@/app/components/StagePill";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import {
  linkHouseholdSecondary,
  mergeDuplicateClients,
} from "./actions";
import type { DuplicateClientPair } from "./types";

const SKIPPED_STORAGE_KEY = "zb-duplicate-review-skipped";

function StatCard({
  label,
  value,
  color = "default",
}: {
  label: string;
  value: number;
  color?: "default" | "blue" | "amber";
}) {
  const valueClass =
    color === "blue"
      ? "text-blue-700 dark:text-blue-300"
      : color === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : "text-slate-900 dark:text-white";
  const borderClass =
    color === "blue"
      ? "border-blue-200 dark:border-blue-800"
      : color === "amber"
        ? "border-amber-200 dark:border-amber-800"
        : "border-slate-200 dark:border-[#1a3550]";

  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm dark:bg-[#0d2035] ${borderClass}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function RecordCard({
  label,
  id,
  name,
  stage,
  noteCount,
}: {
  label: string;
  id: string;
  name: string | null;
  stage: string | null;
  noteCount: number;
}) {
  return (
    <div className="px-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <Link
        href={`/clients/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-[#8DE3B5] hover:underline dark:text-[#7fbf6f]"
      >
        {name?.trim() || "—"}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {stage ? <StagePill stage={stage} /> : null}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {noteCount} note{noteCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

export function DuplicateReviewClient({
  pairs,
  noteMap,
}: {
  pairs: DuplicateClientPair[];
  noteMap: Record<string, number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [skippedPhones, setSkippedPhones] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(SKIPPED_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw) as string[];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });

  const visiblePairs = useMemo(
    () => pairs.filter((p) => !skippedPhones.has(p.phone_mobile)),
    [pairs, skippedPhones]
  );

  const persistSkipped = useCallback((next: Set<string>) => {
    setSkippedPhones(next);
    try {
      localStorage.setItem(SKIPPED_STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // private mode
    }
  }, []);

  const handleSkip = useCallback(
    (phone: string) => {
      const next = new Set(skippedPhones);
      next.add(phone);
      persistSkipped(next);
      toast.success("Skipped for this session");
    },
    [persistSkipped, skippedPhones, toast]
  );

  const handleMerge = useCallback(
    async (keepId: string, deleteId: string, pairKey: string) => {
      if (
        !window.confirm(
          "Merge these records? All notes, reminders, and documents from the secondary client will move to the primary, then the secondary record will be deleted."
        )
      ) {
        return;
      }
      setBusyKey(pairKey);
      try {
        const result = await mergeDuplicateClients(keepId, deleteId);
        if (!result.success) {
          console.error("[merge] server error:", result.error);
          toast.error(toUserFacingError(result.error));
          return;
        }
        toast.success("Clients merged");
        router.refresh();
      } catch (e) {
        toast.error(toUserFacingError(e instanceof Error ? e.message : "Merge failed"));
      } finally {
        setBusyKey(null);
      }
    },
    [router, toast]
  );

  const handleLinkHousehold = useCallback(
    async (
      primaryId: string,
      secondaryId: string,
      secondaryName: string,
      pairKey: string
    ) => {
      if (
        !window.confirm(
          "Link as secondary contact? Notes will move to the primary record and the duplicate client will be removed."
        )
      ) {
        return;
      }
      setBusyKey(pairKey);
      try {
        const result = await linkHouseholdSecondary(
          primaryId,
          secondaryId,
          secondaryName
        );
        if (!result.success) {
          console.error("[merge] server error:", result.error);
          toast.error(toUserFacingError(result.error));
          return;
        }
        toast.success("Linked as household secondary");
        router.refresh();
      } catch (e) {
        toast.error(toUserFacingError(e instanceof Error ? e.message : "Link failed"));
      } finally {
        setBusyKey(null);
      }
    },
    [router, toast]
  );

  const householdCount = visiblePairs.filter((p) => p.is_likely_household).length;
  const duplicateCount = visiblePairs.filter((p) => !p.is_likely_household).length;

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Duplicate Phones" value={visiblePairs.length} />
        <StatCard label="Likely Households" value={householdCount} color="blue" />
        <StatCard label="True Duplicates" value={duplicateCount} color="amber" />
      </div>

      {skippedPhones.size > 0 ? (
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          {skippedPhones.size} phone number{skippedPhones.size === 1 ? "" : "s"} skipped locally.{" "}
          <button
            type="button"
            className="font-medium text-[#8DE3B5] hover:underline"
            onClick={() => persistSkipped(new Set())}
          >
            Clear skipped
          </button>
        </p>
      ) : null}

      {visiblePairs.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 dark:border-[#1a3550] dark:bg-[#0d2035] dark:text-slate-400">
          No duplicate phone groups to review.
        </p>
      ) : (
        visiblePairs.map((pair) => {
          const pairKey = `${pair.primary_id}:${pair.secondary_id}`;
          const isBusy = busyKey === pairKey;
          const primaryFirst = (pair.primary_name ?? "Client").split(" ")[0] ?? "Primary";

          return (
            <div
              key={pairKey}
              className={`mb-3 overflow-hidden rounded-lg border bg-white dark:bg-[#0d2035] ${
                pair.is_likely_household
                  ? "border-blue-200 dark:border-blue-800"
                  : "border-amber-200 dark:border-amber-800"
              }`}
            >
              <div
                className={`flex flex-col gap-3 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                  pair.is_likely_household
                    ? "bg-blue-50 dark:bg-blue-950/30"
                    : "bg-amber-50 dark:bg-amber-950/20"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {pair.phone_mobile}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      pair.is_likely_household
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                    }`}
                  >
                    {pair.is_likely_household ? "🏠 Household" : "⚠️ True Duplicate"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {pair.record_count} records on this number
                  </span>
                </div>

                {!pair.is_likely_household ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void handleMerge(pair.primary_id, pair.secondary_id, pairKey)
                      }
                      className="rounded-md bg-[#8DE3B5] px-3 py-1.5 text-xs font-medium text-[#0A2540] hover:bg-[#6BC99A] disabled:opacity-50"
                    >
                      {isBusy ? "Merging…" : `Merge → Keep ${primaryFirst}`}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSkip(pair.phone_mobile)}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1a3550] dark:text-slate-300 dark:hover:bg-[#102840]"
                    >
                      Skip
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void handleLinkHousehold(
                        pair.primary_id,
                        pair.secondary_id,
                        pair.secondary_name ?? "",
                        pairKey
                      )
                    }
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isBusy ? "Linking…" : "Link as Secondary Contact"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-[#1a3550] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <RecordCard
                  label="✅ Keep (Primary)"
                  id={pair.primary_id}
                  name={pair.primary_name}
                  stage={pair.primary_stage}
                  noteCount={noteMap[pair.primary_id] || 0}
                />
                <RecordCard
                  label={
                    pair.is_likely_household
                      ? "👤 Secondary contact"
                      : "🗑️ Merge into primary"
                  }
                  id={pair.secondary_id}
                  name={pair.secondary_name}
                  stage={pair.secondary_stage}
                  noteCount={noteMap[pair.secondary_id] || 0}
                />
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
