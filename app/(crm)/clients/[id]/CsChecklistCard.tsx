"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";
import {
  CS_CHECKLIST_TOTAL,
  type CsChecklistItemKey,
} from "@/lib/clients/cs-checklist";
import type { CsChecklistCardItem } from "@/lib/clients/cs-checklist-query";
import { subscribeClientProfilePatch } from "@/lib/clients/client-profile-patch";
import { setCsChecklistItem } from "../cs-checklist-actions";

/**
 * Client Services checklist on the client profile — the same four items and the
 * same writes as the Priority board, for people who work one client at a time
 * rather than down a list. Rendered only for viewers who can open the board;
 * the server action re-checks that on every write.
 */
export function CsChecklistCard({
  clientId,
  items,
  completeCount,
  nextUpLabel,
}: {
  clientId: string;
  items: CsChecklistCardItem[];
  completeCount: number;
  nextUpLabel: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [pendingKey, setPendingKey] = useState<CsChecklistItemKey | null>(null);
  const [confirmKey, setConfirmKey] = useState<CsChecklistItemKey | null>(null);
  const [liveItems, setLiveItems] = useState(items);
  const [liveCompleteCount, setLiveCompleteCount] = useState(completeCount);
  const [liveNextUpLabel, setLiveNextUpLabel] = useState(nextUpLabel);

  useEffect(() => {
    setLiveItems(items);
    setLiveCompleteCount(completeCount);
    setLiveNextUpLabel(nextUpLabel);
  }, [items, completeCount, nextUpLabel]);

  useEffect(() => {
    return subscribeClientProfilePatch(clientId, (patch) => {
      if (!patch.hasPoaDocument && !patch.poaSignedAt) return;
      setLiveItems((prev) => {
        const next = prev.map((item) =>
          item.key === "poa_on_file" && !item.complete
            ? { ...item, complete: true, autoChecked: true }
            : item
        );
        const completeN = next.filter((item) => item.complete).length;
        setLiveCompleteCount(completeN);
        setLiveNextUpLabel(next.find((item) => !item.complete)?.label ?? null);
        return next;
      });
    });
  }, [clientId]);

  async function apply(itemKey: CsChecklistItemKey, complete: boolean) {
    if (pendingKey) return;
    setConfirmKey(null);
    setPendingKey(itemKey);
    try {
      const result = await setCsChecklistItem({ clientId, itemKey, complete });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    } catch (error) {
      toast.error(toUserFacingError(error));
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded text-sm font-bold text-slate-900 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8DE3B5] dark:text-white dark:hover:text-slate-200"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
            aria-hidden
          />
          Client Services
        </button>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            liveCompleteCount === CS_CHECKLIST_TOTAL
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
          }`}
        >
          {liveCompleteCount} of {CS_CHECKLIST_TOTAL}
        </span>
      </div>

      {open ? (
        <>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            {liveNextUpLabel ? (
              <>
                Next up:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {liveNextUpLabel}
                </span>
              </>
            ) : (
              "All four items are complete."
            )}
          </p>

          <ul className="space-y-1">
            {liveItems.map((item) => {
              const busy = pendingKey === item.key;
              const confirming = confirmKey === item.key;
              const squareClass = item.complete
                ? item.autoChecked
                  ? "bg-emerald-50 text-emerald-600 ring-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "bg-emerald-500 text-white ring-emerald-600/30"
                : "bg-amber-100 text-transparent ring-amber-500/30 dark:bg-amber-950/40";

              return (
                <li key={item.key} className="py-1">
                  <div className="flex items-start gap-2">
                    {item.autoChecked ? (
                      <span
                        title="Set automatically from the signed POA on this client"
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${squareClass}`}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          item.complete
                            ? setConfirmKey(confirming ? null : item.key)
                            : void apply(item.key, true)
                        }
                        aria-pressed={item.complete}
                        aria-label={
                          item.complete
                            ? `${item.label} — complete, undo`
                            : `${item.label} — mark complete`
                        }
                        title={
                          item.complete
                            ? `${item.label} — complete, click to undo`
                            : `${item.label} — outstanding, click to complete`
                        }
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8DE3B5] ${squareClass} ${
                          busy ? "opacity-60" : ""
                        }`}
                      >
                        {busy ? (
                          <Loader2
                            className="h-3 w-3 animate-spin text-slate-500"
                            aria-hidden
                          />
                        ) : item.complete ? (
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        ) : null}
                      </button>
                    )}

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium ${
                          item.complete
                            ? "text-slate-500 dark:text-slate-400"
                            : "text-slate-800 dark:text-slate-100"
                        }`}
                      >
                        {item.label}
                      </p>

                      {confirming ? (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[11px] text-amber-800 dark:text-amber-200">
                            Mark outstanding again?
                          </span>
                          <button
                            type="button"
                            onClick={() => void apply(item.key, false)}
                            className="rounded border border-amber-300 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8DE3B5] dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/40"
                          >
                            Undo
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmKey(null)}
                            className="rounded px-1 py-0.5 text-[11px] text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8DE3B5] dark:text-slate-400 dark:hover:text-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {item.bypassed ? (
                            "Bypassed"
                          ) : item.autoChecked ? (
                            "From signed POA"
                          ) : item.completedAt ? (
                            <>
                              <ClientFormattedDate
                                iso={item.completedAt}
                                pattern="MMM d, yyyy"
                              />
                              {item.completedByName
                                ? ` · ${item.completedByName}`
                                : ""}
                            </>
                          ) : item.complete ? (
                            "Complete"
                          ) : (
                            "Outstanding"
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 border-t border-gray-100 pt-3 text-[11px] text-slate-500 dark:border-[#1a3550] dark:text-slate-400">
            POA on File fills in on its own from the signed POA, so it is not
            clickable here.{" "}
            <Link
              href="/clients?tab=priority"
              className="font-semibold text-[#8DE3B5] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8DE3B5]"
            >
              Priority board
            </Link>
          </p>
        </>
      ) : null}
    </section>
  );
}
