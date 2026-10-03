"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { toUserFacingError } from "@/lib/user-facing-error";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(toUserFacingError(error.message));
        return;
      }
      router.replace("/portal");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F6F8] px-4 py-10 dark:bg-[#121212]">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="Golden Pathway"
            width={200}
            height={60}
            className="h-auto max-w-[200px] object-contain"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          <h1 className="text-center text-xl font-semibold text-slate-900 dark:text-white">
            Client portal
          </h1>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Sign in with the email and password for your case.
          </p>

          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]"
                required
              />
            </div>
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[#A87830] py-3 text-sm font-bold text-[#161616] disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Trouble signing in?{" "}
            <span className="text-slate-800 dark:text-slate-200">
              Contact your case manager
            </span>{" "}
            for help.
          </p>
        </div>
      </div>
    </main>
  );
}
