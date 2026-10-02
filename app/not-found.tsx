import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        The page you requested does not exist.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-flex justify-center text-sm font-medium text-[#8DE3B5] hover:underline"
      >
        Go to login
      </Link>
    </main>
  );
}
