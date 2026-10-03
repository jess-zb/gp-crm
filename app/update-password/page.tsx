"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { EyeIcon } from "@/components/ui/eye-icon";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<{ text: string; variant: "error" | "success" } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    // Supabase exchanges the recovery token from the URL hash automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage({ text: "Passwords do not match.", variant: "error" });
      return;
    }
    if (password.length < 8) {
      setMessage({ text: "Password must be at least 8 characters.", variant: "error" });
      return;
    }
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage({ text: error.message || "Failed to update password.", variant: "error" });
    } else {
      setMessage({ text: "Password updated! Redirecting to sign in…", variant: "success" });
      setTimeout(() => router.push("/login"), 2000);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#161616] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/favicon.png"
            alt="Golden Pathway"
            width={72}
            height={72}
            className="h-[72px] w-[72px] object-contain"
          />
          <h1 className="mt-4 text-2xl font-bold text-white">Golden Pathway CRM</h1>
          <p className="mt-3 text-sm text-[#E8EAEE]/90">Set your new password</p>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-md">
          {!ready ? (
            <div className="text-center">
              <p className="text-sm text-slate-500">Verifying your reset link…</p>
              <p className="mt-3 text-xs text-slate-400">
                If nothing happens,{" "}
                <a href="/login" className="text-[#161616] underline">
                  return to sign in
                </a>{" "}
                and request a new link.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 pr-11 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-[#A87830]"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <EyeIcon open={showPassword} size={18} />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Confirm new password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Re-enter password"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-[#A87830]"
                />
              </div>
              {message ? (
                <p
                  className={
                    message.variant === "success"
                      ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                      : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  }
                >
                  {message.text}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#A87830] px-4 py-2.5 text-sm font-semibold text-[#161616] transition hover:bg-[#8C6428] disabled:opacity-50"
              >
                {loading ? "Updating…" : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
