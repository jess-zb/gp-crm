"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";

type Props = {
  clientId: string;
  stage: string;
  canAct: boolean;
  userId: string;
  performerName: string;
};

export function AttorneyCaseStageActions({
  clientId,
  stage,
  canAct,
  userId,
  performerName,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState<"close" | "revert" | null>(null);

  if (!canAct) return null;

  async function runUpdate(
    newStage: "closed" | "case_sent_to_attorneys",
    action: "stage_advanced" | "stage_reverted",
    opts?: { successMsg?: string; offerUndoToast?: boolean }
  ) {
    setLoading(newStage === "closed" ? "close" : "revert");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not signed in.");
      setLoading(null);
      return;
    }

    const oldS = newStage === "closed" ? "case_sent_to_attorneys" : "closed";
    const { error: uErr } = await supabase
      .from("clients")
      .update({ stage: newStage, stage_entered_at: new Date().toISOString() })
      .eq("id", clientId);

    if (uErr) {
      toast.error(toUserFacingError(uErr.message));
      setLoading(null);
      return;
    }

    const { error: aErr } = await supabase.from("audit_log").insert({
      client_id: clientId,
      action,
      old_value: { stage: oldS },
      new_value: { stage: newStage },
      performed_by: userId,
      performed_by_name: performerName,
    });

    if (aErr) {
      toast.error(toUserFacingError(aErr.message));
      setLoading(null);
      return;
    }

    const successMsg =
      opts?.successMsg ??
      (newStage === "closed" ? "Case marked as closed" : "Close undone — case is active again");

    if (newStage === "closed" && opts?.offerUndoToast) {
      toast.success(successMsg, {
        durationMs: 10000,
        action: {
          label: "Undo",
          onClick: () => {
            void runUpdate("case_sent_to_attorneys", "stage_reverted", {
              successMsg: "Close undone — case is active again",
            });
          },
        },
      });
    } else {
      toast.success(successMsg);
    }

    setLoading(null);
    router.refresh();
  }

  function handleCloseCase() {
    if (
      !window.confirm(
        "Mark this case as closed?\n\nYou can undo this right away from the toast or using Undo Close Case on this page."
      )
    ) {
      return;
    }
    void runUpdate("closed", "stage_advanced", {
      successMsg: "Case marked as closed",
      offerUndoToast: true,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stage === "case_sent_to_attorneys" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={handleCloseCase}
          className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500"
        >
          {loading === "close" ? "Closing…" : "Close Case"}
        </button>
      ) : null}
      {stage === "closed" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() =>
            void runUpdate("case_sent_to_attorneys", "stage_reverted", {
              successMsg: "Close undone — case is active again",
            })
          }
          className="rounded-lg border-2 border-[#A87830] bg-transparent px-4 py-2 text-sm font-semibold text-[#A87830] transition hover:bg-[#A87830]/10 disabled:opacity-50 dark:text-[#7fbf6f] dark:hover:bg-[#A87830]/20"
        >
          {loading === "revert" ? "Undoing…" : "Undo Close Case"}
        </button>
      ) : null}
    </div>
  );
}
