import Link from "next/link";

export default function ClientNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
        Client not found
      </h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        This client record does not exist or you do not have permission to view
        it.
      </p>
      <Link
        href="/clients"
        className="mt-8 inline-block text-sm font-semibold text-[#8DE3B5] hover:underline dark:text-[#8DE3B5]"
      >
        ← Back to clients
      </Link>
    </main>
  );
}