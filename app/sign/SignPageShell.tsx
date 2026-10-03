import { BUSINESS_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/constants/business-contact";

export function SignPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]" style={{ colorScheme: "light" }}>
      <header className="bg-[#161616]">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={BUSINESS_NAME}
            width={160}
            height={48}
            className="h-10 w-auto object-contain"
          />
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-[13px] leading-5 text-slate-500">
        <p className="flex flex-wrap items-center justify-center">
          <span className="font-semibold text-[#161616]">{BUSINESS_NAME}</span>
          <span className="mx-2 text-lg font-bold leading-none text-[#A87830]" aria-hidden>
            •
          </span>
          {SUPPORT_EMAIL}
          <span className="mx-2 text-lg font-bold leading-none text-[#A87830]" aria-hidden>
            •
          </span>
          {SUPPORT_PHONE}
        </p>
      </footer>
    </div>
  );
}
