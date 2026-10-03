"use client";

import { useEffect, useState } from "react";
import { Loader2, Shuffle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isHiddenProfile } from "@/lib/constants/hidden-accounts";
import { ModalOverlay } from "@/app/components/ModalOverlay";

export type AssignmentDepartment = "accounts" | "services";

export type AssignmentModalProps = {
  open: boolean;
  title: string;
  department: AssignmentDepartment;
  loading?: boolean;
  onAssign: (userId: string, userName: string) => void;
  onSkip: () => void;
};

type TeamMember = { id: string; full_name: string | null; email: string | null; role: string | null };

export function AssignmentModal({
  open,
  title,
  department,
  loading = false,
  onAssign,
  onSkip,
}: AssignmentModalProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!open) {
      setSelectedId("");
      setTeamMembers([]);
      return;
    }
    const col = department === "accounts" ? "is_accounts" : "is_services";
    const supabase = createClient();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: me } = auth.user
        ? await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle()
        : { data: null };
      const viewerRole = (me?.role as string | null) ?? "";
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq(col, true)
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      if (error) {
        console.error("[AssignmentModal] profiles:", error.message);
        setTeamMembers([]);
        return;
      }
      setTeamMembers(
        ((data ?? []) as TeamMember[]).filter((member) => !isHiddenProfile(member, viewerRole))
      );
    })();
  }, [open, department]);

  function handleRandom() {
    if (!teamMembers.length) return;
    const random = teamMembers[Math.floor(Math.random() * teamMembers.length)]!;
    setSelectedId(random.id);
  }

  if (!open) return null;

  return (
    <ModalOverlay
      labelledBy="assign-modal-title"
      className="z-[220] bg-black/40"
    >
      <div className="crm-modal-panel max-w-sm">
        <h3 id="assign-modal-title" className="crm-modal-title">{title}</h3>
        <p className="crm-modal-subtitle">
          Select a team member or assign at random.
        </p>

        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loading}
          aria-label="Select team member"
          className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#A87830] focus:outline-none dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white disabled:opacity-50"
        >
          <option value="">Select team member...</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name?.trim() || m.email || m.id}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleRandom}
          disabled={loading}
          aria-label="Assign a random team member from the list"
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-500 transition-colors hover:border-[#A87830] hover:text-[#A87830] dark:border-slate-600 dark:text-slate-400 dark:hover:border-[#A87830] dark:hover:text-[#A87830] disabled:opacity-50"
        >
          <Shuffle className="h-4 w-4 shrink-0" />
          Assign at Random
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-[#2E2E2E] dark:text-slate-300 dark:hover:bg-[#242424] disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedId) return;
              const member = teamMembers.find((m) => m.id === selectedId);
              onAssign(selectedId, member?.full_name?.trim() || member?.email || "");
            }}
            disabled={!selectedId || loading}
            className="flex-1 rounded-lg bg-[#A87830] py-2.5 text-sm font-medium text-[#161616] transition-colors hover:bg-[#8C6428] disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign"
            )}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
