"use client";

import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { EmailSequenceToggle } from "@/app/components/settings/EmailSequenceToggle";
import { toUserFacingError } from "@/lib/user-facing-error";

const STORAGE_KEY = "zb-theme";

const cardClass =
  "rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-[#A87830] focus:outline-none focus:ring-2 focus:ring-[#A87830]/20 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-white";

const emailInputClass =
  "mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-500 shadow-sm dark:border-[#2E2E2E] dark:bg-[#0a120b] dark:text-slate-500";

export function SettingsClient({
  initialFullName,
  email,
  roleDisplay,
  showWorkspace,
  isDev,
}: {
  initialFullName: string | null;
  email: string | null;
  roleDisplay: string;
  showWorkspace: boolean;
  /** DocuSign extraction download (Workspace link). */
  isDev: boolean;
}) {
  const toast = useToast();
  const supabase = createClient();

  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [nameSaving, setNameSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [dark, setDark] = useState(false);

  useEffect(() => {
    setFullName(initialFullName ?? "");
  }, [initialFullName]);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const applyTheme = useCallback((next: "light" | "dark") => {
    const root = document.documentElement;
    if (next === "dark") {
      root.classList.add("dark");
      localStorage.setItem(STORAGE_KEY, "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem(STORAGE_KEY, "light");
    }
    setDark(next === "dark");
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const name = fullName.trim();
    if (!name) {
      toast.error("Enter your full name.");
      return;
    }
    setNameSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not signed in.");
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", user.id);
      if (error) {
        toast.error(toUserFacingError(error.message));
        return;
      }
      toast.success("Profile saved");
    } finally {
      setNameSaving(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        toast.error(toUserFacingError(error.message));
        return;
      }
      toast.success("Password saved");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setPasswordSaving(false);
    }
  }

  const displayEmail = email ?? "—";

  const workspaceLinkClass =
    "flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-[#A87830]/50 hover:bg-white dark:border-[#2E2E2E] dark:bg-[#121212]/50 dark:text-[#E8EAEE] dark:hover:border-[#A87830]/40 dark:hover:bg-[#1C1C1C]";

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h2 className="text-base font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
          My account
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Your name appears across the CRM where your activity is shown.
        </p>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          <span className="font-medium text-slate-800 dark:text-slate-200">Role</span>
          <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:bg-[#242424] dark:text-[#A87830]">
            {roleDisplay}
          </span>
        </p>
        <form onSubmit={saveProfile} className="mt-6 max-w-lg space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-slate-800 dark:text-slate-200">Full name</span>
            <input
              type="text"
              name="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-800 dark:text-slate-200">Email</span>
            <input
              type="email"
              value={displayEmail}
              readOnly
              disabled
              className={emailInputClass}
              aria-readonly="true"
            />
          </label>
          <button
            type="submit"
            disabled={nameSaving}
            className="rounded-lg bg-[#A87830] px-4 py-2.5 text-sm font-bold text-[#161616] shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {nameSaving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className="text-base font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
          Change password
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Choose a strong password you have not used elsewhere.
        </p>
        <form onSubmit={savePassword} className="mt-6 max-w-lg space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-slate-800 dark:text-slate-200">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Confirm new password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={passwordSaving}
            className="rounded-lg bg-[#A87830] px-4 py-2.5 text-sm font-bold text-[#161616] shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {passwordSaving ? "Saving…" : "Save password"}
          </button>
        </form>
      </section>

      {showWorkspace ? (
        <section className={cardClass}>
          <h2 className="text-base font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
            Workspace
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Admin tools and shared resources.
          </p>
          <nav className="mt-6 flex flex-col gap-2" aria-label="Workspace links">
            <Link href="/settings/templates" className={workspaceLinkClass}>
              <span>Message Templates</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
            </Link>
            <Link href="/settings/mids" className={workspaceLinkClass}>
              <span>MIDs &amp; E-Sign Documents</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
            </Link>
            <Link href="/team" className={workspaceLinkClass}>
              <span>Team Management</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
            </Link>
            <Link href="/admin/attorney-queue" className={workspaceLinkClass}>
              <span>Attorney Queue</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
            </Link>
          </nav>

        </section>
      ) : null}

      <section className={cardClass}>
        <h2 className="text-base font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
          Appearance
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Theme preference synced with sidebar toggle.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Theme</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => applyTheme("light")}
              className={`rounded-md px-3 py-2 text-base leading-none transition ${
                !dark
                  ? "bg-[#A87830] text-[#161616] shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-200 dark:hover:bg-[#242424]"
              }`}
              aria-label="Light mode"
              aria-pressed={!dark}
            >
              ☀
            </button>
            <button
              type="button"
              onClick={() => applyTheme("dark")}
              className={`rounded-md px-3 py-2 text-base leading-none transition ${
                dark
                  ? "bg-[#A87830] text-[#161616] shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-200 dark:hover:bg-[#242424]"
              }`}
              aria-label="Dark mode"
              aria-pressed={dark}
            >
              ☾
            </button>
          </div>
        </div>
      </section>

      {isDev ? <EmailSequenceToggle /> : null}
    </div>
  );
}
