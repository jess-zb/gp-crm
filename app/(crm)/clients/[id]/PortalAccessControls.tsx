"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";

/**
 * Copy a one-time portal setup link. Calls `POST /api/portal/send-invite` to mint
 * `portal_invite_token` and returns `/portal/setup?token=…`.
 */
export function PortalAccessControls({ clientId }: { clientId: string }) {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showModal) return;
    let cancelled = false;
    setInviteUrl(null);
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/portal/send-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId }),
        });
        const j = (await res.json()) as {
          success?: boolean;
          setupUrl?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !j.success || !j.setupUrl) {
          toast.error(toUserFacingError(j.error ?? "Could not create invite link."));
          setInviteUrl(null);
          return;
        }
        setInviteUrl(j.setupUrl);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showModal, clientId, toast]);

  return (
    <div className="sm:col-span-2">
      <span className="font-medium text-slate-700 dark:text-slate-300">Portal setup</span>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#A87830] shadow-sm hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#121212] dark:hover:bg-[#242424]"
        >
          Copy portal setup link
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Each invite generates a new single-use link. The client signs in with the email on their
        client record.
      </p>

      {showModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="portal-invite-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
            <h4
              id="portal-invite-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Portal setup link
            </h4>
            {loading ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Generating link…</p>
            ) : inviteUrl ? (
              <p className="mt-3 break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]">
                {inviteUrl}
              </p>
            ) : (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                Could not load a link. Close and try again.
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={!inviteUrl || loading}
                onClick={() => {
                  if (!inviteUrl) return;
                  void navigator.clipboard.writeText(inviteUrl);
                  toast.success("Link copied");
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-200"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg bg-[#A87830] px-4 py-2 text-sm font-bold text-[#161616] shadow hover:opacity-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
