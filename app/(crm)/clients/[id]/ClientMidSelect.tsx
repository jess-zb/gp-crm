"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMids } from "@/lib/hooks/use-mids";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";

export function ClientMidSelect({
  clientId,
  midId,
  midName,
}: {
  clientId: string;
  midId: string | null;
  midName: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const { mids } = useMids();
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(midId ?? "");

  useEffect(() => {
    setSelectedId(midId ?? "");
  }, [midId]);

  const options = useMemo(() => {
    const rows = mids.map((mid) => ({ id: mid.id, name: mid.name }));
    if (midId && midName?.trim() && !rows.some((row) => row.id === midId)) {
      rows.unshift({ id: midId, name: midName.trim() });
    }
    return rows;
  }, [midId, midName, mids]);

  async function onChange(nextId: string) {
    if (!nextId || nextId === selectedId || saving) return;
    const previous = selectedId;
    setSelectedId(nextId);
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("clients").update({ mid_id: nextId }).eq("id", clientId);
    setSaving(false);
    if (error) {
      setSelectedId(previous);
      toast.error(toUserFacingError(error.message));
      return;
    }
    toast.success("MID updated");
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 py-2 lg:w-auto lg:shrink-0 lg:py-0 lg:pb-2">
      <span className="sr-only">Client MID</span>
      <select
        aria-label="Client MID"
        value={selectedId}
        disabled={saving}
        onChange={(event) => void onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 shadow-sm focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 disabled:opacity-60 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-300 lg:w-auto lg:max-w-[16rem]"
      >
        {selectedId ? null : <option value="">No MID</option>}
        {options.map((mid) => (
          <option key={mid.id} value={mid.id}>
            {`MID · ${mid.name}`}
          </option>
        ))}
      </select>
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden /> : null}
    </label>
  );
}
