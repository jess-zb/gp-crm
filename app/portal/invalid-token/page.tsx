import Link from "next/link";

export default function PortalInvalidTokenPage() {
  return (
    <main className="min-h-screen bg-[#F5F6F8] px-4 py-10 dark:bg-[#121212]">
      <div className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-950 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <h1 className="text-base font-semibold text-amber-950 dark:text-amber-50">
          Link invalid or expired
        </h1>
        <p className="mt-3 leading-relaxed">
          This portal setup link is not valid or has already been used. Ask your case manager for a
          new invite.
        </p>
        <Link
          href="/portal/login"
          className="mt-6 inline-block font-medium text-[#A87830] underline"
        >
          Portal sign in
        </Link>
      </div>
    </main>
  );
}
