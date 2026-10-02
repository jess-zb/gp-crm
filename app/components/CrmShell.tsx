"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { CrmProviders } from "@/app/components/CrmProviders";
import { Sidebar } from "@/app/components/Sidebar";
import { ChatWidget, type ChatWidgetUserProfile } from "@/app/components/chat/ChatWidget";
import { AlertNotification } from "@/app/components/AlertNotification";

const STORAGE_KEY = "zb-sidebar-collapsed";

type Props = {
  children: React.ReactNode;
  displayName: string;
  role: string;
  userId: string;
  chatProfile: ChatWidgetUserProfile | null;
};

export function CrmShell({
  children,
  displayName,
  role,
  userId,
  chatProfile,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1") {
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    console.log("[CrmShell] chatProfile:", chatProfile);
  }, [chatProfile]);

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

  const onToggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

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

        <Sidebar
          displayName={displayName}
          role={role}
          userId={userId}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
          mobileOpen={mobileMenuOpen}
          onMobileClose={closeMobileMenu}
        />
        {userId ? <AlertNotification userId={userId} /> : null}
        <div
          className={`min-h-screen transition-[padding] duration-200 ease-out ${
            collapsed ? "pl-0 lg:pl-16" : "pl-0 lg:pl-56"
          }`}
        >
          <div className="min-h-screen overflow-x-hidden bg-[#F8FAFC] text-sm text-slate-900 transition-colors duration-200 ease-out dark:bg-[#071929] dark:text-[#E8EAEE]">
            <div className="sticky top-0 z-30 flex min-h-[52px] items-center gap-2 border-b border-slate-200 bg-white px-2 pb-1.5 pt-[max(0.375rem,env(safe-area-inset-top,0px))] dark:border-[#1a3550] dark:bg-[#0d2035] lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-[#102840]"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
            <div className="main-content page-transition min-w-0">{children}</div>
          </div>
        </div>
        {chatProfile ? <ChatWidget userProfile={chatProfile} /> : null}
      </div>
    </CrmProviders>
  );
}
