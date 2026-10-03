"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";

export function EmailSequenceToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const toast = useToast();
  const supabase = createClient();

  useEffect(() => {
    void supabase
      .from("crm_settings")
      .select("value")
      .eq("key", "email_sequences_enabled")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("[EmailSequenceToggle] load error:", error.message);
        }
        setEnabled(data?.value === "true");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const toggle = async () => {
    const newVal = !enabled;
    setEnabled(newVal);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("crm_settings").upsert({
      key: "email_sequences_enabled",
      value: String(newVal),
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setEnabled(!newVal);
      toast.error("Failed to update setting");
    } else {
      toast.success(newVal ? "Email sequences enabled" : "Email sequences paused");
    }
  };

  const testDispatch = useCallback(async () => {
    setDispatching(true);
    try {
      const res = await fetch("/api/dev/dispatch-emails", { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "Dispatch failed");
      } else {
        toast.warning(JSON.stringify(result));
      }
    } catch {
      toast.error("Dispatch request failed");
    } finally {
      setDispatching(false);
    }
  }, [toast]);

  if (loading) return null;

  return (
    <div className="crm-card mt-6 border-2 border-dashed border-amber-200 bg-amber-50/50 p-6 dark:border-amber-800/60 dark:bg-amber-950/20">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Email Sequences
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              Dev Only
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Automated email campaigns via Resend. Only activate when domain is verified.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          aria-pressed={enabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-[#A87830]" : "bg-slate-200 dark:bg-slate-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {enabled ? (
        <div className="mt-3 flex items-center gap-3 border-t border-amber-200 pt-3 dark:border-amber-800/60">
          <p className="flex-1 text-xs font-medium text-green-600 dark:text-green-400">
            Active — cron sends hourly
          </p>
          <button
            type="button"
            disabled={dispatching}
            onClick={() => void testDispatch()}
            className="crm-btn-secondary px-3 py-1 text-xs disabled:opacity-60"
          >
            {dispatching ? "Running…" : "Run Now"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
