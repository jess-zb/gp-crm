"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ChevronLeft,
  Hash,
  Plus,
  Send,
  Smile,
  User,
  Volume2,
  X,
} from "lucide-react";
import { MessageCircleIcon } from "@/components/ui/message-circle-icon";
import { createClient } from "@/lib/supabase/client";
import { isHiddenFromRole } from "@/lib/constants/hidden-accounts";

const COMMON_EMOJIS = [
  "😀",
  "😂",
  "😊",
  "😍",
  "🥰",
  "😎",
  "🤔",
  "😅",
  "👍",
  "👎",
  "❤️",
  "🔥",
  "✅",
  "⚠️",
  "🎉",
  "💪",
  "🙏",
  "👏",
  "😢",
  "😡",
  "🤝",
  "💼",
  "📋",
  "📞",
  "⏰",
  "✍️",
  "📌",
  "🚀",
  "💡",
  "🔍",
  "📊",
  "🎯",
];

export type ChatWidgetUserProfile = {
  id: string;
  full_name: string | null;
  role: string;
  is_accounts: boolean | null;
  is_services: boolean | null;
};

type StaffProfile = {
  id: string;
  full_name: string | null;
  role: string;
  email?: string | null;
};

type DmParticipant = {
  id: string;
  full_name: string | null;
};

type ChatChannel = {
  id: string;
  name: string;
  type: string;
  department: string | null;
  created_at?: string | null;
  participant_1?: string | null;
  participant_2?: string | null;
  otherName?: string;
  p1?: DmParticipant | DmParticipant[] | null;
  p2?: DmParticipant | DmParticipant[] | null;
};

type ChatSender = {
  id: string;
  full_name: string | null;
  email?: string | null;
};

type ChatMessageRow = {
  id: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
  sender: ChatSender | ChatSender[] | null;
};

function normalizeSender(
  raw: ChatMessageRow["sender"]
): { id: string; full_name: string | null } | null {
  if (!raw) return null;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s?.id) return null;
  return { id: s.id, full_name: s.full_name ?? null };
}

function normalizeParticipant(
  raw: DmParticipant | DmParticipant[] | null | undefined
): DmParticipant | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function ChannelItem({
  unread,
  active,
  onClick,
  label,
  isDm = false,
  isAnnouncement = false,
}: {
  unread: number;
  active: boolean;
  onClick: () => void;
  label: string;
  isDm?: boolean;
  isAnnouncement?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#242424]/60 ${
        active ? "bg-slate-50 dark:bg-[#242424]/60" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {isAnnouncement ? (
          <Volume2 className="h-4 w-4 shrink-0 text-[#A87830]" aria-hidden />
        ) : isDm ? (
          <User className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <Hash className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
        <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {label}
        </p>
      </div>
      {unread > 0 ? (
        <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}

export function ChatWidget({
  userProfile,
}: {
  userProfile: ChatWidgetUserProfile | null;
}) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [dmChannels, setDmChannels] = useState<ChatChannel[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [staffUsers, setStaffUsers] = useState<StaffProfile[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const openRef = useRef(open);
  const activeChannelIdRef = useRef<string | null>(null);
  const visibleIdsRef = useRef<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);
  const userProfileRef = useRef(userProfile);
  const didInitUnreadRef = useRef(false);
  const dmChannelsRef = useRef<ChatChannel[]>([]);
  const channelsRef = useRef<ChatChannel[]>([]);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    userProfileRef.current = userProfile;
    userIdRef.current = userProfile?.id ?? null;
    console.log("[ChatWidget] userProfile loaded:", {
      id: userProfile?.id,
      role: userProfile?.role,
      name: userProfile?.full_name,
    });
  }, [userProfile]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-emoji-panel]") &&
        !target.closest("[data-emoji-btn]")
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showEmojiPicker]);

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((sum, n) => sum + n, 0),
    [unreadCounts]
  );

  const openChannel = useCallback((channel: ChatChannel) => {
    setActiveChannel(channel);
    setUnreadCounts((prev) => ({ ...prev, [channel.id]: 0 }));
  }, []);

  const getDmDisplayName = useCallback((ch: ChatChannel): string => {
    return ch.otherName?.trim() || "Direct Message";
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);

      console.log("[ChatWidget] played sound ✓");
    } catch (e) {
      console.warn("[ChatWidget] sound error:", e);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const loadStaffUsers = useCallback(async () => {
    if (!userProfile?.id) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, email")
      .neq("role", "client")
      .neq("id", userProfile.id)
      .order("full_name");

    if (error) {
      console.warn("[ChatWidget] staff users", error.message);
      return;
    }
    const viewerRole = userProfile.role ?? "";
    setStaffUsers(
      ((data ?? []) as StaffProfile[]).filter(
        (u) => !isHiddenFromRole(u.email, viewerRole)
      )
    );
  }, [supabase, userProfile?.id, userProfile?.role]);

  const loadDmChannels = useCallback(async (): Promise<ChatChannel[]> => {
    if (!userProfile?.id) return [];

    const { data: dmRows, error: chError } = await supabase
      .from("chat_channels")
      .select("id, name, type, department, participant_1, participant_2")
      .eq("type", "direct")
      .or(
        `participant_1.eq.${userProfile.id},participant_2.eq.${userProfile.id}`
      );

    if (chError) {
      console.error("[ChatWidget] load DMs:", chError.message);
      return [];
    }

    if (!dmRows?.length) {
      setDmChannels([]);
      return [];
    }

    const otherIds = dmRows
      .map((ch) =>
        ch.participant_1 === userProfile.id ? ch.participant_2 : ch.participant_1
      )
      .filter((id): id is string => Boolean(id));

    const { data: others, error: pError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", otherIds);

    if (pError) {
      console.error(
        "[ChatWidget] load profiles:",
        pError.message,
        "← likely RLS issue"
      );
    }

    const profileMap: Record<string, string> = Object.fromEntries(
      (others ?? [])
        .map((p) => [p.id, (p.full_name as string | null)?.trim() ?? ""])
        .filter(([, name]) => name.length > 0)
    );

    console.log("[ChatWidget] profile map:", profileMap);

    const enriched: ChatChannel[] = dmRows.map((ch) => {
      const otherId =
        ch.participant_1 === userProfile.id ? ch.participant_2 : ch.participant_1;
      const otherName = otherId ? profileMap[otherId] || "Team Member" : "Team Member";
      return {
        ...ch,
        otherName,
        p1:
          ch.participant_1 === userProfile.id
            ? { id: userProfile.id, full_name: userProfile.full_name }
            : otherId
              ? { id: otherId, full_name: profileMap[otherId] ?? null }
              : null,
        p2:
          ch.participant_2 === userProfile.id
            ? { id: userProfile.id, full_name: userProfile.full_name }
            : otherId
              ? { id: otherId, full_name: profileMap[otherId] ?? null }
              : null,
      };
    });

    setDmChannels(enriched);
    return enriched;
  }, [supabase, userProfile]);

  const startDm = useCallback(
    async (otherUser: StaffProfile) => {
      if (!userProfile?.id) return;

      const me = userProfile.id;
      const them = otherUser.id;

      const { data: existing } = await supabase
        .from("chat_channels")
        .select("id, name, type, department, participant_1, participant_2")
        .eq("type", "direct")
        .or(`participant_1.eq.${me},participant_2.eq.${me}`);

      const existingDm = existing?.find(
        (ch) =>
          (ch.participant_1 === me && ch.participant_2 === them) ||
          (ch.participant_1 === them && ch.participant_2 === me)
      );

      if (existingDm) {
        const enriched: ChatChannel = {
          ...existingDm,
          participant_1: me,
          participant_2: them,
          otherName: otherUser.full_name?.trim() || "Team Member",
          p1: { id: me, full_name: userProfile.full_name },
          p2: { id: them, full_name: otherUser.full_name },
        };
        setActiveChannel(enriched);
        setDmChannels((prev) => {
          const idx = prev.findIndex((c) => c.id === existingDm.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = enriched;
            return next;
          }
          return [...prev, enriched];
        });
        setUnreadCounts((prev) => ({ ...prev, [existingDm.id]: 0 }));
        setShowUserPicker(false);
        return;
      }

      const { data: newChannel, error } = await supabase
        .from("chat_channels")
        .insert({
          name: `dm-${me.slice(0, 8)}-${them.slice(0, 8)}`,
          type: "direct",
          department: null,
          participant_1: me,
          participant_2: them,
        })
        .select("id, name, type, department, participant_1, participant_2")
        .single();

      if (error) {
        // The other person opened the same DM first; adopt theirs.
        if (error.code === "23505") {
          const refreshed = await loadDmChannels();
          const theirs = refreshed.find(
            (ch) =>
              (ch.participant_1 === me && ch.participant_2 === them) ||
              (ch.participant_1 === them && ch.participant_2 === me)
          );
          if (theirs) {
            setActiveChannel(theirs);
            setUnreadCounts((prev) => ({ ...prev, [theirs.id]: 0 }));
          }
        } else {
          console.error("[ChatWidget] create dm:", error.message);
        }
        setShowUserPicker(false);
        return;
      }

      if (newChannel) {
        const enriched: ChatChannel = {
          ...newChannel,
          participant_1: me,
          participant_2: them,
          otherName: otherUser.full_name?.trim() || "Team Member",
          p1: { id: me, full_name: userProfile.full_name },
          p2: { id: them, full_name: otherUser.full_name },
        };
        setDmChannels((prev) => [...prev, enriched]);
        setActiveChannel(enriched);
        setUnreadCounts((prev) => ({ ...prev, [enriched.id]: 0 }));
      }
      setShowUserPicker(false);
    },
    [supabase, userProfile, loadDmChannels]
  );

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    activeChannelIdRef.current = activeChannel?.id ?? null;
  }, [activeChannel?.id]);

  const visibleChannels = useMemo(
    () =>
      channels.filter((ch) => {
        if (ch.type === "announcement") return true;
        if (ch.type === "direct") return false;

        if (!userProfile) return true;

        if (["dev", "admin"].includes(userProfile.role || "")) return true;

        if (ch.type === "department") {
          if (!ch.department) return true;
          if (ch.department === "accounts" && userProfile.is_accounts) return true;
          if (ch.department === "services" && userProfile.is_services) return true;
          return false;
        }

        return false;
      }),
    [channels, userProfile]
  );

  useEffect(() => {
    const ids = new Set([
      ...visibleChannels.map((c) => c.id),
      ...dmChannels.map((c) => c.id),
    ]);
    visibleIdsRef.current = ids;
  }, [visibleChannels, dmChannels]);

  /** The badge is the only unread signal, so it has to survive a reload. */
  const refreshUnreadCounts = useCallback(
    async (channelIds: string[]) => {
      const myId = userProfile?.id;
      if (!myId || channelIds.length === 0) return;

      const [{ data: receipts }, { data: rows }] = await Promise.all([
        supabase
          .from("chat_read_receipts")
          .select("channel_id, last_read_at")
          .eq("user_id", myId),
        supabase
          .from("chat_messages")
          .select("channel_id, created_at")
          .in("channel_id", channelIds)
          .neq("sender_id", myId)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const lastReadAt = new Map(
        (receipts ?? []).map((r) => [r.channel_id, r.last_read_at])
      );

      const counts: Record<string, number> = {};
      for (const row of rows ?? []) {
        const seenAt = lastReadAt.get(row.channel_id);
        if (seenAt && new Date(row.created_at) <= new Date(seenAt)) continue;
        counts[row.channel_id] = (counts[row.channel_id] ?? 0) + 1;
      }
      setUnreadCounts(counts);
    },
    [supabase, userProfile?.id]
  );

  useEffect(() => {
    if (!userProfile?.id || didInitUnreadRef.current) return;
    const ids = [
      ...visibleChannels.map((c) => c.id),
      ...dmChannels.map((c) => c.id),
    ];
    if (ids.length === 0) return;
    didInitUnreadRef.current = true;
    void refreshUnreadCounts(ids);
  }, [userProfile?.id, visibleChannels, dmChannels, refreshUnreadCounts]);

  useEffect(() => {
    dmChannelsRef.current = dmChannels;
  }, [dmChannels]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  /** Re-apply names from staff picker list when profiles RLS hides other users. */
  useEffect(() => {
    if (!userProfile?.id || staffUsers.length === 0) return;
    setDmChannels((prev) => {
      let changed = false;
      const next = prev.map((ch) => {
        if (ch.otherName && ch.otherName !== "Team Member") return ch;
        const otherId =
          ch.participant_1 === userProfile.id ? ch.participant_2 : ch.participant_1;
        if (!otherId) return ch;
        const fromStaff = staffUsers.find((u) => u.id === otherId)?.full_name?.trim();
        if (!fromStaff) return ch;
        changed = true;
        return { ...ch, otherName: fromStaff };
      });
      return changed ? next : prev;
    });
  }, [staffUsers, userProfile?.id]);

  useEffect(() => {
    const loadChannels = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.log("[ChatWidget] No session found");
        return;
      }

      const { data, error } = await supabase
        .from("chat_channels")
        .select("id, name, type, department")
        .neq("type", "direct")
        .order("type");

      if (error) {
        console.error("[ChatWidget] channels error:", error.message, error.code);
        return;
      }

      setChannels((data ?? []) as ChatChannel[]);
    };

    void loadChannels();
    void loadDmChannels();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void loadChannels();
        void loadDmChannels();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, loadDmChannels, userProfile?.id]);

  const scrollToBottom = useCallback(() => {
    window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => {
    if (!activeChannel) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    let channelSub: RealtimeChannel | null = null;

    const run = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select(
          `
          id, body, created_at, edited_at,
          sender:sender_id(id, full_name, email)
        `
        )
        .eq("channel_id", activeChannel.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (cancelled) return;
      if (error) {
        console.warn("[ChatWidget] messages", error.message);
        setMessages([]);
        return;
      }
      setMessages((data ?? []) as ChatMessageRow[]);
      scrollToBottom();

      if (userProfile) {
        const now = new Date().toISOString();
        setUnreadCounts((prev) => ({ ...prev, [activeChannel.id]: 0 }));
        await supabase.from("chat_read_receipts").upsert(
          {
            user_id: userProfile.id,
            channel_id: activeChannel.id,
            last_read_at: now,
          },
          { onConflict: "user_id,channel_id" }
        );
      }

      channelSub = supabase
        .channel(`chat:${activeChannel.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `channel_id=eq.${activeChannel.id}`,
          },
          async (payload) => {
            const newId = (payload.new as { id?: string })?.id;
            if (!newId) return;
            const { data: row } = await supabase
              .from("chat_messages")
              .select(
                `
                id, body, created_at, edited_at,
                sender:sender_id(id, full_name, email)
              `
              )
              .eq("id", newId)
              .maybeSingle();
            if (row) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === (row as ChatMessageRow).id)) return prev;
                return [...prev, row as ChatMessageRow];
              });
              scrollToBottom();
            }
          }
        )
        .subscribe();
    };

    void run();

    return () => {
      cancelled = true;
      if (channelSub) void supabase.removeChannel(channelSub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll only; avoid re-subscribe
  }, [activeChannel?.id, supabase, userProfile?.id]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const myProfileId =
        userProfileRef.current?.id ?? session?.user?.id ?? userIdRef.current;

      if (!myProfileId) {
        console.warn("[ChatWidget] Realtime: no authenticated user id");
        return;
      }
      userIdRef.current = myProfileId;

      const channel = supabase
        .channel("chat-messages")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
          },
          (payload) => {
            const row = payload.new as {
              channel_id?: string;
              sender_id?: string;
            };
            const myId = userProfileRef.current?.id ?? userIdRef.current;

            if (!row.channel_id) return;
            if (row.sender_id === myId) return;

            const channelId = row.channel_id;

            // Unread is shown only as a badge count on the launcher, so a
            // message that is already on screen needs no signal at all.
            const notify = () => {
              if (activeChannelIdRef.current === channelId && openRef.current) {
                return;
              }
              playNotificationSound();
              setUnreadCounts((prev) => ({
                ...prev,
                [channelId]: (prev[channelId] || 0) + 1,
              }));
            };

            if (visibleIdsRef.current.has(channelId)) {
              notify();
              return;
            }

            // Someone may have just opened a DM with us, so the channel is not
            // in our list yet. Anything still unknown after a refresh is not
            // ours to be notified about.
            void loadDmChannels().then((refreshed) => {
              if (refreshed.some((ch) => ch.id === channelId)) notify();
            });
          }
        )
        .subscribe((status) => {
          console.log("[ChatWidget] Realtime status:", status);
        });

      if (cancelled) {
        void supabase.removeChannel(channel);
        return;
      }

      realtimeChannelRef.current = channel;
    };

    void setup();

    return () => {
      cancelled = true;
      const ch = realtimeChannelRef.current;
      if (ch) {
        void supabase.removeChannel(ch);
        realtimeChannelRef.current = null;
      }
    };
  }, [supabase, userProfile, playNotificationSound, loadDmChannels]);

  const sendMessage = async () => {
    if (!input.trim() || !activeChannel || !userProfile) return;

    if (
      activeChannel.type === "announcement" &&
      userProfile.role !== "dev" &&
      userProfile.role !== "admin"
    ) {
      return;
    }

    const body = input.trim();
    setInput("");

    const { error } = await supabase.from("chat_messages").insert({
      channel_id: activeChannel.id,
      sender_id: userProfile.id,
      body,
    });
    if (error) {
      console.warn("[ChatWidget] send", error.message);
      setInput(body);
    }
  };

  const isAnnouncement = activeChannel?.type === "announcement";
  const isDm = activeChannel?.type === "direct";
  const canPost =
    !isAnnouncement ||
    userProfile?.role === "dev" ||
    userProfile?.role === "admin";

  const activeLabel = activeChannel
    ? isDm
      ? getDmDisplayName(activeChannel)
      : activeChannel.name
    : "Messages";

  return (
    <div
      className="pointer-events-none fixed z-50 flex flex-col items-end"
      style={{
        bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        right: "calc(1rem + env(safe-area-inset-right, 0px))",
      }}
    >
      {open ? (
        <div className="chat-panel-mobile pointer-events-auto relative mb-3 flex h-[520px] w-80 max-w-none flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl max-sm:h-[calc(100dvh-5rem)] max-sm:max-h-[calc(100dvh-5rem)] max-sm:w-[calc(100vw-1rem)] dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
          <div
            className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-[#2E2E2E] dark:bg-[#242424]/50"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
          >
            {activeChannel ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveChannel(null)}
                  className="rounded-md text-slate-400 transition-colors hover:bg-slate-200/80 hover:text-slate-600 dark:hover:bg-[#121212] dark:hover:text-slate-200"
                  aria-label="Back to channels"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                  {isAnnouncement ? (
                    <Volume2 className="h-4 w-4 shrink-0 text-[#A87830]" aria-hidden />
                  ) : isDm ? (
                    <User className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  ) : (
                    <Hash className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  )}
                  <span className="truncate">{activeLabel}</span>
                </span>
              </>
            ) : (
              <span className="flex-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                Messages
              </span>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200/80 hover:text-slate-600 dark:hover:bg-[#121212] dark:hover:text-slate-200"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!activeChannel ? (
            <div className="relative min-h-0 flex-1 overflow-y-auto py-2">
              {visibleChannels.length === 0 && channels.length === 0 && dmChannels.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  Loading channels...
                </p>
              ) : null}
              {visibleChannels.length === 0 && channels.length > 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  No channels available for your role.
                </p>
              ) : null}

              <div className="px-3 py-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Channels
                </p>
                {visibleChannels.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    unread={unreadCounts[ch.id] ?? 0}
                    active={false}
                    onClick={() => openChannel(ch)}
                    label={ch.name}
                    isAnnouncement={ch.type === "announcement"}
                  />
                ))}
              </div>

              <div className="border-t border-slate-100 px-3 py-2 dark:border-[#2E2E2E]">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Direct Messages
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void loadStaffUsers();
                      setShowUserPicker(true);
                    }}
                    className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                    title="New DM"
                    aria-label="New direct message"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {dmChannels.length === 0 ? (
                  <p className="px-1 text-xs italic text-slate-400">No messages yet</p>
                ) : null}

                {dmChannels.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    unread={unreadCounts[ch.id] ?? 0}
                    active={false}
                    onClick={() => openChannel(ch)}
                    label={getDmDisplayName(ch)}
                    isDm
                  />
                ))}
              </div>

              {showUserPicker ? (
                <div className="absolute inset-0 z-10 flex flex-col rounded-xl bg-white dark:bg-[#1C1C1C]">
                  <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-[#2E2E2E]">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      New Direct Message
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowUserPicker(false)}
                      aria-label="Close picker"
                    >
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    {staffUsers.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-slate-400">
                        Loading team members…
                      </p>
                    ) : null}
                    {staffUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => void startDm(user)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#242424]/60"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#A87830]">
                          <span className="text-xs font-bold text-white">
                            {user.full_name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase() || "?"}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          {user.full_name?.trim() || user.email || "Team member"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {messages.map((msg) => {
                  const sender = normalizeSender(msg.sender);
                  const isMe = userProfile ? sender?.id === userProfile.id : false;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className="mb-0.5 flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {isMe ? "You" : sender?.full_name?.trim() || "Team"}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div
                        className={`max-w-[85%] break-words rounded-lg px-3 py-2 text-[13px] ${
                          isMe
                            ? "rounded-br-sm bg-[#A87830] text-[#161616]"
                            : "rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-[#242424] dark:text-slate-100"
                        }`}
                      >
                        {msg.body}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="relative shrink-0 border-t border-slate-100 dark:border-[#2E2E2E]">
                {isAnnouncement && !canPost ? (
                  <p className="px-3 py-3 text-center text-[12px] text-slate-400 dark:text-slate-500">
                    Only admins can post here
                  </p>
                ) : (
                  <>
                    {showEmojiPicker ? (
                      <div
                        data-emoji-panel
                        className="absolute bottom-12 left-0 z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
                      >
                        <div className="grid grid-cols-8 gap-0.5">
                          {COMMON_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setInput((prev) => prev + emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="flex items-center justify-center rounded p-1 text-base leading-none transition-colors hover:bg-slate-100 dark:hover:bg-[#242424]"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="relative flex items-center gap-1.5 px-3 pb-3 pt-3">
                      <button
                        type="button"
                        data-emoji-btn
                        onClick={() => setShowEmojiPicker((e) => !e)}
                        className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#242424] dark:hover:text-slate-200"
                        aria-label="Add emoji"
                      >
                        <Smile className="h-4 w-4" />
                      </button>
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                          }
                        }}
                        placeholder="Type a message…"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#A87830] focus:ring-1 focus:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={!input.trim()}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#A87830] transition-colors hover:bg-[#8C6428] disabled:bg-slate-200 dark:disabled:bg-slate-700"
                        aria-label="Send"
                      >
                        <Send className="h-3.5 w-3.5 text-white disabled:text-slate-400" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleOpen}
        className="pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full bg-[#A87830] text-[#161616] shadow-lg transition-all duration-200 hover:scale-105 hover:bg-[#8C6428] hover:shadow-xl"
        aria-label={open ? "Close messages" : "Open messages"}
      >
        <MessageCircleIcon className="h-7 w-7 text-white" />
        {totalUnread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        ) : null}
      </button>
    </div>
  );
}
