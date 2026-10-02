"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { toUserFacingError } from "@/lib/user-facing-error";

type Props = {
  token: string;
  firstName: string;
};

export default function PortalSetupClient({ token, firstName }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/portal/complete-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; email?: string };
      if (!res.ok || !data.ok) {
        toast.error(toUserFacingError(data.error ?? "Could not create account."));
        return;
      }

      const email = data.email;
      if (!email) {
        toast.error("Account created but email missing. Contact support.");
        return;
      }

      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) {
        toast.error(toUserFacingError(signErr.message));
        router.replace("/portal/login");
        return;
      }

      toast.success("Welcome! Redirecting…");
      router.replace("/portal");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F6F8] px-4 py-10 dark:bg-[#071929]">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="DebtSupportPros"
            width={200}
            height={60}
            className="h-auto max-w-[200px] object-contain"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <h1 className="text-center text-xl font-semibold text-slate-900 dark:text-white">
            Set your password
          </h1>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Hi {firstName || "there"} — create a password to access your client
            portal.
          </p>

          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm dark:border-[#1a3550] dark:bg-[#071929] dark:text-[#E8EAEE]"
                required
                minLength={8}
              />
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Confirm password
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm dark:border-[#1a3550] dark:bg-[#071929] dark:text-[#E8EAEE]"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[#8DE3B5] py-3 text-sm font-bold text-[#0A2540] disabled:opacity-50"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{" "}
            <Link href="/portal/login" className="font-medium text-[#8DE3B5] underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
