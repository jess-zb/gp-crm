"use client";

import Link from "next/link";

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-lg font-semibold text-red-600 dark:text-red-400">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
        An unexpected error occurred while loading this client. Please try again
        or contact support if the problem persists.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-8 flex gap-4">
        <button
          onClick={reset}
          className="text-sm font-semibold text-[#A87830] hover:underline dark:text-[#A87830]"
        >
          Try again
        </button>
        <Link
          href="/clients"
          className="text-sm font-semibold text-slate-600 hover:underline dark:text-slate-400"
        >
          ← Back to clients
        </Link>
      </div>
    </main>
  );
}