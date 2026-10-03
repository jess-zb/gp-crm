"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import type { MidRow } from "@/lib/mids/queries";
import { createMid, deleteMid, renameMid, setMidActive } from "./actions";

export type MidListRow = MidRow & {
  clientCount: number;
  templateCount: number;
};

export function MidsClient({ mids }: { mids: MidListRow[] }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function run(
    work: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string
  ) {
    startTransition(async () => {
      const res = await work();
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  }

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      const res = await createMid(name);
      if (res.ok) setNewName("");
      return res;
    }, `${name} added`);
  }

  return (
    <div className="space-y-6">
      <section className="gp-card">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Add a MID
        </h2>
        <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
          New clients can be assigned to it immediately. Add its e-sign
          documents from the MID&apos;s own page — no developer needed.
        </p>
        <form onSubmit={onAdd} className="mt-3 flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. PostLogic"
            aria-label="MID name"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
          />
          <button
            type="submit"
            disabled={pending || !newName.trim()}
            className="crm-btn-primary !px-4 !py-2 !text-sm"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            Add MID
          </button>
        </form>
      </section>

      <section className="gp-card !p-0">
        {mids.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              No MIDs yet
            </p>
            <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
              Add one above. Every client is assigned to a MID when it is
              created.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#2E2E2E]">
            {mids.map((mid) => {
              const isEditing = editingId === mid.id;
              return (
                <li key={mid.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const name = editName.trim();
                            if (!name) return;
                            run(async () => {
                              const res = await renameMid(mid.id, name);
                              if (res.ok) setEditingId(null);
                              return res;
                            }, "MID renamed");
                          }}
                          className="flex flex-wrap gap-2"
                        >
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            aria-label={`Rename ${mid.name}`}
                            autoFocus
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white"
                          />
                          <button
                            type="submit"
                            disabled={pending}
                            className="crm-btn-primary !px-3 !py-1.5 !text-xs"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-[#2E2E2E] dark:text-slate-300"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                              {mid.name}
                            </p>
                            {!mid.is_active ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-[#242424] dark:text-slate-300">
                                Inactive
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                            {mid.clientCount} client
                            {mid.clientCount === 1 ? "" : "s"} ·{" "}
                            {mid.templateCount} e-sign document
                            {mid.templateCount === 1 ? "" : "s"}
                          </p>
                        </>
                      )}
                    </div>

                    {!isEditing ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Link
                          href={`/settings/mids/${mid.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
                        >
                          E-Sign documents
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(mid.id);
                            setEditName(mid.name);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-[#2E2E2E] dark:text-slate-300 dark:hover:bg-[#242424]"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => setMidActive(mid.id, !mid.is_active),
                              mid.is_active ? "MID deactivated" : "MID activated"
                            )
                          }
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-[#2E2E2E] dark:text-slate-300 dark:hover:bg-[#242424]"
                        >
                          {mid.is_active ? "Deactivate" : "Activate"}
                        </button>
                        {mid.clientCount === 0 && mid.templateCount === 0 ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() => deleteMid(mid.id), "MID deleted")
                            }
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
