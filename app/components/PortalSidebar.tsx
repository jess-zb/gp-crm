"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "zb-theme";
const ACTIVE_BG = "#A87830";
/** Stand out on both light sidebar and dark sidebar. */

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return "?";
}

export type PortalSidebarProps = {
  displayName: string;
  onSignOut: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function PortalSidebar({
  displayName,
  onSignOut,
  mobileOpen = false,
  onMobileClose,
}: PortalSidebarProps) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const applyTheme = useCallback((next: "light" | "dark") => {
    const root = document.documentElement;
    if (next === "dark") {
      root.classList.add("dark");
      localStorage.setItem(STORAGE_KEY, "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem(STORAGE_KEY, "light");
    }
    setDark(next === "dark");
  }, []);

  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const firstNameOnly = useMemo(() => {
    const trimmed = displayName.trim();
    const first = trimmed.split(/\s+/).filter(Boolean)[0];
    return first || trimmed || "User";
  }, [displayName]);

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out dark:border-[#2E2E2E] dark:bg-[#1C1C1C] md:z-40 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="flex shrink-0 justify-center border-b border-slate-200 px-4 py-4 dark:border-[#2E2E2E]">
        <Link
          href="/portal"
          className="block transition-opacity duration-200 ease-out hover:opacity-90"
          onClick={() => onMobileClose?.()}
        >
          <Image
            src="/logo.png"
            alt="Golden Pathway"
            width={140}
            height={42}
            className="mx-auto block h-auto max-w-[140px] object-contain"
          />
        </Link>
      </div>

      <div className="min-h-0 flex-1" aria-hidden />

      <div className="mt-auto shrink-0 space-y-3 border-t border-slate-200 p-3 dark:border-[#2E2E2E]">
        <div className="flex items-center gap-3 px-1">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: ACTIVE_BG }}
            title={displayName}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold leading-snug text-slate-900 dark:text-[#E8EAEE]">
              {firstNameOnly}
            </p>
            <p className="text-xs font-medium capitalize leading-snug text-slate-500 dark:text-slate-400">
              Client portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => applyTheme("light")}
            className={`inline-flex flex-1 items-center justify-center rounded-lg py-2 text-base leading-none transition-colors duration-200 ease-out ${
              !dark
                ? "bg-[#A87830] text-[#161616] shadow-sm"
                : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-slate-300 dark:hover:bg-[#242424]"
            }`}
            aria-label="Light mode"
            aria-pressed={!dark}
          >
            <span className="text-[18px] leading-none" aria-hidden>
              ☀
            </span>
          </button>
          <button
            type="button"
            onClick={() => applyTheme("dark")}
            className={`inline-flex flex-1 items-center justify-center rounded-lg py-2 text-base leading-none transition-colors duration-200 ease-out ${
              dark
                ? "bg-[#A87830] text-[#161616] shadow-sm"
                : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-slate-300 dark:hover:bg-[#242424]"
            }`}
            aria-label="Dark mode"
            aria-pressed={dark}
          >
            <span className="text-[18px] leading-none" aria-hidden>
              ☾
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onMobileClose?.();
            onSignOut();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE] dark:hover:bg-[#242424]"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  );
}
