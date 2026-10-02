"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { ModalOverlay } from "@/app/components/ModalOverlay";
import {
  isBuiltInMerchantOption,
  PACKET_MID_EXTRAS_SETTING_KEY,
} from "@/lib/constants/merchants";

export function ManagePacketMidOptions({
  extras,
  onExtrasChange,
}: {
  extras: string[];
  onExtrasChange: (next: string[]) => void;
}) {
  const toast = useToast();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function persist(next: string[]) {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("crm_settings").upsert({
        key: PACKET_MID_EXTRAS_SETTING_KEY,
        value: JSON.stringify(next),
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        toast.error(error.message || "Failed to save MID options");
        return false;
      }
      onExtrasChange(next);
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const name = draft.trim();
    if (!name) return;

    const lower = name.toLowerCase();
    if (isBuiltInMerchantOption(name) || extras.some((e) => e.toLowerCase() === lower)) {
      toast.error("That MID is already in the list");
      return;
    }

    const ok = await persist([...extras, name]);
    if (ok) {
      setDraft("");
      toast.success(`Added “${name}” to MID dropdown`);
    }
  }

  async function handleRemove(name: string) {
    const ok = await persist(extras.filter((e) => e !== name));
    if (ok) toast.success(`Removed “${name}”`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="crm-btn-secondary flex items-center gap-1.5 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        Add MID
      </button>

      {open ? (
        <ModalOverlay labelledBy="add-mid-title" onBackdropClick={() => setOpen(false)}>
          <div className="flex w-full max-w-md max-h-[calc(100vh-2rem)] flex-col rounded-xl bg-white shadow-xl dark:border dark:border-[#1a3550] dark:bg-[#0d2035]">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div>
                <h2
                  id="add-mid-title"
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                >
                  MID options
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Extra names appear in every MID dropdown. Built-in merchants stay in the list.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#102840] dark:hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {extras.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No extras yet. Add one below.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {extras.map((name) => (
                    <li
                      key={name}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 dark:border-[#1a3550] dark:text-slate-100"
                    >
                      {name}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleRemove(name)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-[#102840] dark:hover:text-slate-200"
                        aria-label={`Remove ${name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-slate-200 px-5 py-4 dark:border-[#1a3550]">
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                New MID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAdd();
                    }
                  }}
                  placeholder="Processor name"
                  disabled={saving}
                  className="crm-input min-w-0 flex-1 text-sm"
                />
                <button
                  type="button"
                  disabled={saving || !draft.trim()}
                  onClick={() => void handleAdd()}
                  className="crm-btn-primary shrink-0 px-3 text-xs disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </>
  );
}
