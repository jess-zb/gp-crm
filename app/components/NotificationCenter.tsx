"use client";

import { Bell, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { CRMNotification } from "@/lib/notifications/types";
import { formatShortDateTime } from "@/lib/utils/date";

const KNOWN_NOTIF_TYPES = new Set([
  "appointment",
  "collection_letter",
  "stage_change",
  "team_message",
  "announcement",
  "attorney_portal_assignment",
]);

function rowToNotification(row: Record<string, unknown>): CRMNotification | null {
  if (row.id == null) return null;
  const rawType = String(row.type ?? "other");
  const type = (KNOWN_NOTIF_TYPES.has(rawType)
    ? rawType
    : "other") as CRMNotification["type"];
  return {
    id: String(row.id),
    type,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    client_id: row.client_id ? String(row.client_id) : undefined,
    client_name: row.client_name ? String(row.client_name) : undefined,
    read: Boolean(row.read),
    created_at: String(row.created_at ?? ""),
    action_url: row.action_url ? String(row.action_url) : undefined,
  };
}

function notificationBodyPreview(notif: CRMNotification): string {
  if (notif.type !== "announcement") return notif.body;
  const lines = notif.body.split("\n").filter(Boolean);
  const content = lines.find((line) => !line.startsWith("ANN_SOURCE:") && !line.startsWith("posted:"));
  return content ?? notif.body;
}

/** Relative in-app path for notification click-through (Next.js router needs paths, not full URLs). */
function notificationHref(notif: CRMNotification, userRole: string): string | null {
  if (notif.type === "attorney_portal_assignment" && notif.client_id) {
    return `/attorney/cases/${notif.client_id}`;
  }
  if (notif.client_id && userRole === "attorney") {
    return `/attorney/cases/${notif.client_id}`;
  }
  const raw = notif.action_url?.trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  if (typeof window !== "undefined") {
    try {
      const u = new URL(raw, window.location.origin);
      if (u.origin === window.location.origin) {
        return `${u.pathname}${u.search}${u.hash}`;
      }
    } catch {
      return null;
    }
  }
  try {
    const u = new URL(raw);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

function shouldShowNotification(notif: CRMNotification, userRole: string): boolean {
  if (userRole === "attorney" && notif.type === "announcement") {
    return false;
  }
  return true;
}

type MacToast = { dismissId: string; notif: CRMNotification };

export function NotificationBell({
  userId,
  navCollapsed,
  userRole = "",
  sidebarDark = false,
}: {
  userId: string;
  navCollapsed: boolean;
  displayName?: string;
  userRole?: string;
  /** Match navy CRM sidebar (attorney portal) instead of light footer styles. */
  sidebarDark?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<CRMNotification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [macToasts, setMacToasts] = useState<MacToast[]>([]);
  const isAttorneyView = userRole === "attorney";

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const dismissMacToast = useCallback((dismissId: string) => {
    setMacToasts((prev) => prev.filter((t) => t.dismissId !== dismissId));
  }, []);

  const showToastNotification = useCallback(
    (notif: CRMNotification) => {
      const toastBody = notificationBodyPreview(notif);

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          try {
            new Notification(notif.title, {
              body: toastBody,
              icon: "/favicon.png",
              badge: "/favicon.png",
            });
          } catch {
            /* ignore */
          }
        }
      }

      const dismissId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now());
      setMacToasts((prev) => [
        ...prev,
        { dismissId, notif: { ...notif, body: toastBody } },
      ]);
      window.setTimeout(() => dismissMacToast(dismissId), 5000);
    },
    [dismissMacToast]
  );

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    setLoadingNotifs(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("Notifications load error:", error);
        return;
      }
      const mapped = (data ?? [])
        .map((r) => rowToNotification(r as Record<string, unknown>))
        .filter((x): x is CRMNotification => x != null)
        .filter((n) => shouldShowNotification(n, userRole));
      setNotifications(mapped);
    } finally {
      setLoadingNotifs(false);
    }
  }, [supabase, userId, userRole]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (showNotifications) {
      void loadNotifications();
    }
  }, [showNotifications, loadNotifications]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const newNotif = rowToNotification(row);
          if (!newNotif || !shouldShowNotification(newNotif, userRole)) return;
          setNotifications((prev) => {
            if (prev.some((p) => p.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
          showToastNotification(newNotif);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, showToastNotification, userRole]);

  useEffect(() => {
    if (!showNotifications) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setShowNotifications(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showNotifications]);

  const markAllRead = useCallback(async () => {
    if (notifications.filter((n) => !n.read).length === 0) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) {
      console.warn("[notifications] mark all:", error.message);
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [notifications, supabase, userId]);

  const markOneRead = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) console.warn("[notifications] mark one:", error.message);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    },
    [supabase, userId]
  );

  const handleNotificationClick = useCallback(
    (notif: CRMNotification) => {
      void markOneRead(notif.id);
      const href = notificationHref(notif, userRole);
      if (href) {
        router.push(href);
      }
      setShowNotifications(false);
    },
    [markOneRead, router, userRole]
  );

  const bellButtonClass = sidebarDark
    ? "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-[#C8C2B8] transition-colors hover:bg-[#161616] hover:text-white"
    : "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100";

  return (
    <>
      <div className="relative shrink-0 px-1 pb-1 pt-1">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setShowNotifications((prev) => !prev)}
          className={bellButtonClass}
        >
          <div className="relative shrink-0">
            <Bell
              className={`h-4 w-4 ${sidebarDark ? "text-[#C8C2B8]" : ""}`}
              strokeWidth={2}
              aria-hidden
            />
            {unreadCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </div>
          {!navCollapsed ? (
            <span
              className={`text-[13px] font-medium ${sidebarDark ? "text-[#C8C2B8]" : ""}`}
            >
              Notifications
            </span>
          ) : (
            <span className="sr-only">Notifications</span>
          )}
        </button>

        {showNotifications ? (
          <div
            ref={panelRef}
            className="absolute bottom-12 left-2 right-2 z-50 flex max-h-[28rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
          >
            <div className="flex shrink-0 items-center justify-center gap-1 border-b border-gray-100 py-2.5 text-xs font-semibold text-gray-700 dark:border-[#2E2E2E] dark:text-slate-200">
              Notifications
              {unreadCount > 0 ? (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </div>

            {unreadCount > 0 ? (
              <div className="flex justify-end border-b border-gray-50 px-4 py-1.5 dark:border-[#2E2E2E]">
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs text-[#A87830] hover:underline"
                >
                  Mark all read
                </button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingNotifs ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Loading notifications…
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="mx-auto mb-2 h-8 w-8 text-gray-200 dark:text-slate-600" />
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                    No notifications yet
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                    {isAttorneyView
                      ? "New case assignments from staff will appear here"
                      : "Stage changes, messages and appointments will appear here"}
                  </p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const emoji =
                    notif.type === "attorney_portal_assignment"
                      ? "⚖️"
                      : notif.type === "team_message"
                        ? "💬"
                        : notif.type === "announcement"
                          ? "📢"
                          : notif.type === "appointment"
                            ? "⏰"
                            : notif.type === "stage_change"
                              ? "🔄"
                              : notif.type === "collection_letter"
                                ? "📄"
                                : "🔔";
                  const bubbleClass =
                    notif.type === "attorney_portal_assignment"
                      ? "bg-emerald-100 dark:bg-emerald-950/50"
                      : notif.type === "team_message"
                        ? "bg-blue-100 dark:bg-blue-950/50"
                        : notif.type === "announcement"
                          ? "bg-orange-100 dark:bg-orange-950/50"
                          : notif.type === "appointment"
                            ? "bg-yellow-100 dark:bg-yellow-950/50"
                            : notif.type === "stage_change"
                              ? "bg-purple-100 dark:bg-purple-950/50"
                              : notif.type === "collection_letter"
                                ? "bg-emerald-100 dark:bg-emerald-950/50"
                                : "bg-gray-100 dark:bg-[#2E2E2E]";

                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => handleNotificationClick(notif)}
                      className={`flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-[#2E2E2E] dark:hover:bg-[#242424] ${
                        !notif.read ? "bg-green-50/40 dark:bg-[#242424]/60" : ""
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${bubbleClass}`}
                      >
                        {emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 dark:text-[#E8EAEE]">
                          {notif.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-slate-400">
                          {notificationBodyPreview(notif)}
                        </p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                          {formatShortDateTime(notif.created_at)}
                        </p>
                      </div>
                      {!notif.read ? (
                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#A87830]" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="pointer-events-none fixed right-4 top-4 z-[250] flex max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {macToasts.map(({ dismissId, notif }) => (
          <div
            key={dismissId}
            className="pointer-events-auto zb-mac-notif-enter flex max-w-sm gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-lg dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer gap-3 text-left"
              onClick={() => {
                dismissMacToast(dismissId);
                void markOneRead(notif.id);
                const href = notificationHref(notif, userRole);
                if (href) {
                  router.push(href);
                }
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "#161616" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/favicon.png" alt="" className="h-6 w-6 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-[#E8EAEE]">
                  {notif.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-slate-400">
                  {notificationBodyPreview(notif)}
                </p>
              </div>
            </button>
            <button
              type="button"
              className="pointer-events-auto shrink-0 text-gray-400 hover:text-gray-600 dark:text-slate-500"
              onClick={() => dismissMacToast(dismissId)}
              aria-label="Dismiss toast"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
