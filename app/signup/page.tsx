"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signup, type SignupState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2.5 px-4 bg-[#0D1B2A] hover:bg-[#1A2F45] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
    >
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signup, null as SignupState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1B2A]">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#C9A84C] mb-4">
            <span className="text-[#0D1B2A] text-2xl font-bold">ZB</span>
          </div>
          <h1 className="text-white text-2xl font-semibold">DebtSupportPros CRM</h1>
          <p className="text-slate-400 text-sm mt-1">Create your account</p>
        </div>
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <form action={formAction} className="space-y-5">
            {state?.error ? (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {state.error}
              </div>
            ) : null}
            {state?.info ? (
              <div
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                role="status"
              >
                {state.info}
              </div>
            ) : null}
            <div>
              <label
                htmlFor="signup-email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A] focus:border-transparent"
                placeholder="you@debtsupportpros.com"
              />
            </div>
            <div>
              <label
                htmlFor="signup-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <SubmitButton />
          </form>
          <p className="text-center text-sm text-slate-600 mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[#0D1B2A] hover:underline"
            >
              Log in
            </Link>
          </p>
          <p className="text-center text-xs text-slate-400 mt-4">
            Access may be managed by your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
