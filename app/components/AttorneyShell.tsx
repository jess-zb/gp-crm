"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { CrmProviders } from "@/app/components/CrmProviders";
import { AttorneySidebar } from "@/app/components/AttorneySidebar";

/** Same key as CrmShell so collapse state matches when switching contexts. */
const SIDEBAR_COLLAPSED_KEY = "gp-sidebar-collapsed";

type Props = {
  children: React.ReactNode;
  displayName: string;
  userRole: string;
  userId: string;
  newCaseCount?: number;
};

export function AttorneyShell({
  children,
  displayName,
  userRole,
  userId,
  newCaseCount = 0,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") {
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onToggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

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
    <CrmProviders>
      <div className="min-h-screen overflow-x-hidden">
        {mobileMenuOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={closeMobileMenu}
          />
        ) : null}

        <AttorneySidebar
          displayName={displayName}
          userRole={userRole}
          userId={userId}
          newCaseCount={newCaseCount}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
          mobileOpen={mobileMenuOpen}
          onMobileClose={closeMobileMenu}
        />
        <div
          className={`min-h-screen transition-[padding] duration-300 ease-out ${
            collapsed ? "pl-0 lg:pl-16" : "pl-0 lg:pl-56"
          }`}
        >
          <div className="min-h-screen overflow-x-hidden bg-[#F5F6F8] text-slate-900 transition-colors duration-200 ease-out dark:bg-[#121212] dark:text-[#E8EAEE]">
            <div className="sticky top-0 z-30 flex min-h-[52px] items-center gap-2 border-b border-slate-200/90 bg-[#F5F6F8] px-2 py-1.5 dark:border-[#2E2E2E] dark:bg-[#121212] lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-100 dark:hover:bg-[#242424]"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="main-content min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </CrmProviders>
  );
}
