"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthResponse } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { EyeIcon } from "@/components/ui/eye-icon";

const SIGN_IN_TIMEOUT_MS = 10_000;

async function signInWithTimeout(
  signIn: Promise<AuthResponse>,
  timeoutMs: number = SIGN_IN_TIMEOUT_MS
): Promise<AuthResponse> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            "Connection timed out. Please check your internet connection and try again."
          )
        ),
      timeoutMs
    )
  );
  return Promise.race([signIn, timeout]);
}

function mapAuthErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("timeout") || lower.includes("fetch") || lower.includes("network")) {
    return "Cannot reach the server. Please check your internet connection and try again.";
  }
  if (raw.includes("Invalid") || lower.includes("invalid login")) {
    return "Incorrect email or password.";
  }
  return raw;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<"error" | "success">("error");
  const [signInFailed, setSignInFailed] = useState(false);
  const [connectionTestBusy, setConnectionTestBusy] = useState(false);
  const [view, setView] = useState<"login" | "reset">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const showDiagnostics =
    process.env.NODE_ENV === "development" || signInFailed;

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- intentional dev diagnostic for Supabase URL
      console.log("Supabase URL:", supabaseUrl ? `${supabaseUrl.slice(0, 30)}…` : "(missing)");
    }
  }, [supabaseUrl]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage(null);
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await signInWithTimeout(
        supabase.auth.signInWithPassword({ email, password })
      );

      if (error) {
        const msg = error.message ?? "";
        setStatusVariant("error");
        if (
          msg.toLowerCase().includes("timeout") ||
          msg.toLowerCase().includes("fetch") ||
          msg.toLowerCase().includes("network")
        ) {
          setStatusMessage(
            "Cannot reach the server. Please check your internet connection and try again."
          );
        } else if (msg.includes("Invalid") || msg.toLowerCase().includes("invalid login")) {
          setStatusMessage("Incorrect email or password.");
        } else {
          setStatusMessage(mapAuthErrorMessage(msg) || msg || "Sign in failed.");
        }
        setSignInFailed(true);
        return;
      }

      if (!data.user) {
        setStatusVariant("error");
        setStatusMessage("Sign in failed. Please try again.");
        setSignInFailed(true);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.role === "client") router.push("/portal");
      else if (profile?.role === "attorney") router.push("/attorney/cases");
      else router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setSignInFailed(true);
      const message =
        err instanceof Error
          ? err.message
          : "Connection failed. Please try again.";
      setStatusVariant("error");
      setStatusMessage(message || "Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection() {
    if (!supabaseUrl) {
      setStatusVariant("error");
      setStatusMessage(
        "NEXT_PUBLIC_SUPABASE_URL is not set. Check your environment configuration."
      );
      return;
    }
    setConnectionTestBusy(true);
    try {
      const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`, {
        method: "GET",
        cache: "no-store",
      });
      if (res.ok) {
        setStatusVariant("success");
        setStatusMessage("Server reachable. Check your credentials.");
      } else {
        setStatusVariant("error");
        setStatusMessage(`Server returned error: ${res.status}`);
      }
    } catch {
      setStatusVariant("error");
      setStatusMessage("Cannot reach Supabase. Network or configuration issue.");
    } finally {
      setConnectionTestBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    try {
      await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      setResetSent(true);
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A2540] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/favicon.png"
            alt="DebtSupportPros"
            width={72}
            height={72}
            className="h-[72px] w-[72px] object-contain"
          />
          <h1 className="mt-4 text-2xl font-bold text-white">DebtSupportPros CRM</h1>
          <p className="mt-3 text-sm text-[#E8EAEE]/95">Sign in to your account</p>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-md">
          {view === "reset" ? (
            <div>
              {resetSent ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-800">Check your email</p>
                  <p className="mt-2 text-sm text-slate-500">
                    If an account exists for <span className="font-medium">{resetEmail}</span>, you'll receive a password reset link shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setView("login"); setResetSent(false); setResetEmail(""); }}
                    className="mt-5 text-sm font-medium text-[#0A2540] underline underline-offset-2"
                  >
                    ← Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <p className="mb-4 text-sm text-slate-600">Enter your email and we'll send you a link to reset your password.</p>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      placeholder="you@debtsupportpros.com"
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/30"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full rounded-lg bg-[#8DE3B5] px-4 py-2.5 text-sm font-semibold text-[#0A2540] transition hover:bg-[#6BC99A] disabled:opacity-50"
                  >
                    {resetLoading ? "Sending…" : "Send reset link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
                  >
                    ← Back to sign in
                  </button>
                </form>
              )}
            </div>
          ) : (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (statusMessage) setStatusMessage(null);
                }}
                required
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#8DE3B5] focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]/30"
                placeholder="you@debtsupportpros.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (statusMessage) setStatusMessage(null);
                  }}
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 pr-11 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-[#8DE3B5]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
                >
                  <EyeIcon open={showPassword} size={18} />
                </button>
              </div>
            </div>
            {statusMessage ? (
              <p
                className={
                  statusVariant === "success"
                    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                    : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                }
              >
                {statusMessage}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#8DE3B5] px-4 py-2.5 text-sm font-semibold text-[#0A2540] transition duration-200 ease-out hover:bg-[#6BC99A] disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setView("reset"); setStatusMessage(null); }}
                className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
              >
                Forgot password?
              </button>
            </div>
          </form>
          )}
          {showDiagnostics ? (
            <div className="mt-2 text-center">
              <button
                type="button"
                disabled={connectionTestBusy}
                onClick={() => void handleTestConnection()}
                className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
              >
                {connectionTestBusy ? "Testing…" : "Test connection"}
              </button>
            </div>
          ) : null}
          <p className="mt-6 text-center text-xs text-slate-400">
            Access is managed by your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
