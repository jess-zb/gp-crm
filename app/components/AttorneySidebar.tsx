"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRoleDisplayName } from "@/lib/utils/roles";
import { GearIcon } from "@/components/ui/gear-icon";
import { NotificationBell } from "@/app/components/NotificationCenter";

const STORAGE_KEY = "gp-theme";

type AttorneySidebarProps = {
  displayName: string;
  userRole: string;
  userId: string;
  newCaseCount?: number;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

function useIsLgUp() {
  const [isLgUp, setIsLgUp] = useState(true);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsLgUp(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return isLgUp;
}

const NAV = [
  { href: "/attorney/cases", label: "Cases", Icon: Briefcase, lucide: true },
  { href: "/attorney/settings", label: "Settings", Icon: GearIcon, lucide: false },
] as const;

function isNavActive(pathname: string, href: string) {
  if (href === "/attorney/cases") {
    return pathname === "/attorney/cases" || pathname.startsWith("/attorney/cases/");
  }
  if (href === "/attorney/settings") {
    return pathname === "/attorney/settings" || pathname.startsWith("/attorney/settings/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

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

function navRowClass(active: boolean, collapsed: boolean) {
  const pad = collapsed ? "justify-center px-0 py-2 mx-0.5" : "gap-2.5 px-3 py-2 mx-1";
  const base = `flex items-center rounded-md text-[13px] font-medium transition-colors duration-200 ease-out ${pad}`;
  if (active) {
    return `${base} bg-[#A87830] text-[#161616]`;
  }
  return `${base} group text-[#C8C2B8] hover:bg-[#161616] hover:text-white`;
}

export function AttorneySidebar({
  displayName,
  userRole,
  userId,
  newCaseCount = 0,
  collapsed = false,
  onToggleCollapsed,
  mobileOpen = false,
  onMobileClose,
}: AttorneySidebarProps) {
  const pathname = usePathname() ?? "";
  const isLgUp = useIsLgUp();
  const navCollapsed = collapsed && isLgUp;
  const [dark, setDark] = useState(false);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    onMobileClose?.();
  }, [pathname, onMobileClose]);

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
  const roleLabel = getRoleDisplayName(userRole);
  const widthClass = navCollapsed ? "w-16" : "w-56";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#161616] transition-[transform,width] duration-300 ease-out lg:z-40 ${widthClass} ${
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {!navCollapsed ? (
        <Link
          href="/attorney/cases"
          className="flex shrink-0 items-center justify-center bg-[#161616] px-4 py-4 transition-opacity hover:opacity-95"
          title="Golden Pathway"
        >
          <Image
            src="/logo.png"
            alt="Golden Pathway"
            width={148}
            height={44}
            className="object-contain"
            style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
            priority
          />
        </Link>
      ) : (
        <Link
          href="/attorney/cases"
          className="flex shrink-0 items-center justify-center bg-[#161616] px-4 py-4 transition-opacity hover:opacity-90"
          title="Golden Pathway"
        >
          <Image
            src="/favicon.png"
            alt="Golden Pathway"
            width={28}
            height={28}
            className="object-contain"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
          />
        </Link>
      )}

      {onToggleCollapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden w-full shrink-0 items-center justify-center border-t border-[#161616] py-1.5 text-[#C8C2B8] transition-colors duration-200 ease-out hover:bg-[#161616] hover:text-white lg:flex"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      ) : null}

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-0 overscroll-contain">
        {!navCollapsed ? (
          <p className="px-3 pb-1 gp-sidebar-label">Attorney portal</p>
        ) : null}
        {NAV.map(({ href, label, Icon, lucide }) => {
          const active = isNavActive(pathname, href);
          const showCasesBadge = href === "/attorney/cases" && newCaseCount > 0;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={navRowClass(active, navCollapsed)}
            >
              {lucide ? (
                <Icon
                  className={`h-5 w-5 shrink-0 transition-colors duration-200 ease-out ${
                    active ? "text-[#161616]" : "text-[#C8C2B8] group-hover:text-white"
                  }`}
                  strokeWidth={2}
                  aria-hidden
                />
              ) : (
                <Icon
                  size={20}
                  className={`shrink-0 transition-colors duration-200 ease-out ${
                    active ? "text-[#161616]" : "text-[#C8C2B8] group-hover:text-white"
                  }`}
                  aria-hidden
                />
              )}
              {navCollapsed ? (
                <span className="sr-only">{label}</span>
              ) : (
                <span
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 transition-colors duration-200 ease-out ${
                    active ? "text-[#161616]" : "text-[#C8C2B8] group-hover:text-white"
                  }`}
                >
                  <span>{label}</span>
                  {showCasesBadge ? (
                    <span className="min-w-[18px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-white">
                      {newCaseCount > 99 ? "99+" : newCaseCount}
                    </span>
                  ) : null}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 border-t border-[#2E2E2E]/60">
        <NotificationBell
          userId={userId}
          navCollapsed={navCollapsed}
          displayName={displayName}
          userRole={userRole}
          sidebarDark
        />

        <div className="p-3">
        {navCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#A87830] text-xs font-semibold text-[#161616]"
              title={displayName}
            >
              {initials}
            </div>
            <button
              type="button"
              onClick={() => applyTheme("light")}
              className={`flex h-8 w-full items-center justify-center rounded-md text-sm transition-colors duration-200 ease-out ${
                !dark ? "bg-[#161616] text-white" : "text-[#C8C2B8] hover:bg-[#161616] hover:text-white"
              }`}
              aria-label="Light mode"
              aria-pressed={!dark}
            >
              ☀
            </button>
            <button
              type="button"
              onClick={() => applyTheme("dark")}
              className={`flex h-8 w-full items-center justify-center rounded-md text-sm transition-colors duration-200 ease-out ${
                dark ? "bg-[#161616] text-white" : "text-[#C8C2B8] hover:bg-[#161616] hover:text-white"
              }`}
              aria-label="Dark mode"
              aria-pressed={dark}
            >
              ☾
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex h-8 w-full items-center justify-center rounded-md text-[#C8C2B8] transition-colors duration-200 ease-out hover:text-white"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#A87830] text-xs font-semibold text-[#161616]"
              title={displayName}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{firstNameOnly}</p>
              <p className="truncate text-[11px] text-[#C8C2B8]">{roleLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => applyTheme("light")}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors duration-200 ease-out ${
                  !dark ? "bg-[#161616] text-white" : "text-[#C8C2B8] hover:bg-[#161616] hover:text-white"
                }`}
                aria-label="Light mode"
                aria-pressed={!dark}
              >
                ☀
              </button>
              <button
                type="button"
                onClick={() => applyTheme("dark")}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors duration-200 ease-out ${
                  dark ? "bg-[#161616] text-white" : "text-[#C8C2B8] hover:bg-[#161616] hover:text-white"
                }`}
                aria-label="Dark mode"
                aria-pressed={dark}
              >
                ☾
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#C8C2B8] transition-colors duration-200 ease-out hover:text-white"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </aside>
  );
}
