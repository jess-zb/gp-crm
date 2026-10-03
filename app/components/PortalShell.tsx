"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalSidebar } from "@/app/components/PortalSidebar";

type Props = {
  children: React.ReactNode;
  displayName: string;
  onSignOut: () => void;
};

export function PortalShell({ children, displayName, onSignOut }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeMobileMenu}
        />
      ) : null}

      <PortalSidebar
        displayName={displayName}
        onSignOut={onSignOut}
        mobileOpen={mobileMenuOpen}
        onMobileClose={closeMobileMenu}
      />

      <div className="min-h-screen transition-[padding] duration-200 ease-out pl-0 md:pl-64">
        <div className="sticky top-0 z-30 flex min-h-[52px] items-center gap-2 border-b border-slate-200/90 bg-[#F5F6F8] px-2 py-1.5 dark:border-[#2E2E2E] dark:bg-[#121212] md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-100 dark:hover:bg-[#242424]"
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
