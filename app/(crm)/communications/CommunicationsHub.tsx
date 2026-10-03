"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
  memo,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { formatDateTime } from "@/lib/utils/date";
import { ExternalLink, FileText, Loader2, Search } from "lucide-react";
import { getRoleDisplayName } from "@/lib/utils/roles";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { isHiddenFromRole } from "@/lib/constants/hidden-accounts";

type HubTab = "team" | "departments" | "clients";

type TeamMember = {
  id: string;
  full_name: string | null;
  role: string;
  email: string | null;
};

type CommRow = {
  id: string;
  subject: string | null;
  body: string | null;
  sent_at: string | null;
  recorded_by: string | null;
};

type PortalRow = {
  id: string;
  client_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_role: string | null;
  message: string;
  created_at: string | null;
};

type ClientInboxRow = {
  clientId: string;
  displayName: string;
  lastPreview: string;
  lastAt: string | null;
  unreadCount: number;
};

type DeptDef = { emoji: string; name: string; access: "all" | "admin_dev" };

const ALL_DEPARTMENTS: DeptDef[] = [
  { emoji: "🔵", name: "Client Services", access: "all" },
  { emoji: "🟣", name: "Legal / Attorneys", access: "admin_dev" },
  { emoji: "🟡", name: "Management", access: "admin_dev" },
];

const CHAT_FILE_PREFIX = "_ZB_CHATFILE:";

function dmNotifPreview(body: string | null | undefined): string {
  const b = String(body ?? "");
  if (b.startsWith("_ZB_GIF:")) return "Sent you a GIF";
  if (b.startsWith(CHAT_FILE_PREFIX)) return "Sent you a file";
  return (b || "").slice(0, 80) || "New message";
}

function deptNotifPreview(body: string | null | undefined): string {
  const b = String(body ?? "");
  if (b.startsWith("_ZB_GIF:")) return "Sent a GIF";
  if (b.startsWith(CHAT_FILE_PREFIX)) return "Sent a file";
  return (b || "").slice(0, 80) || "New message";
}

const COMMON_EMOJIS = [
  "👍",
  "👎",
  "😊",
  "😂",
  "🎉",
  "✅",
  "❌",
  "⚠️",
  "📞",
  "📧",
  "📝",
  "🔥",
  "💯",
  "👀",
  "🙏",
  "💪",
  "⏰",
  "📋",
] as const;

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function SendPlaneIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function directThreadSubject(userIdA: string, userIdB: string) {
  const [a, b] = [userIdA, userIdB].sort();
  return `direct:${a}|${b}`;
}

function legacyTeamThreadSubject(userIdA: string, userIdB: string) {
  const [a, b] = [userIdA, userIdB].sort();
  return `team:${a}|${b}`;
}

function deptSubject(departmentName: string) {
  return `dept:${departmentName}`;
}

const DM_LAST_VIEWED_PREFIX = "gp-last-viewed-dm-";
/** Legacy key; still read for migration until users get new keys written. */
const DM_LAST_VIEWED_LEGACY_PREFIX = "gp-hub-team-read:";
const DEPT_LAST_VIEWED_PREFIX = "gp-last-viewed-dept-";

function dmLastViewedMs(peerId: string): number {
  try {
    const raw =
      localStorage.getItem(DM_LAST_VIEWED_PREFIX + peerId) ??
      localStorage.getItem(DM_LAST_VIEWED_LEGACY_PREFIX + peerId);
    if (raw) return new Date(raw).getTime();
  } catch {
    /* ignore */
  }
  return 0;
}

function deptLastViewedMs(deptName: string): number {
  try {
    const raw = localStorage.getItem(DEPT_LAST_VIEWED_PREFIX + deptName);
    if (raw) return new Date(raw).getTime();
  } catch {
    /* ignore */
  }
  return 0;
}

function peerFromSubject(subject: string | null, me: string): string | null {
  if (!subject) return null;
  const d = subject.match(/^direct:(.+)\|(.+)$/);
  const t = subject.match(/^team:(.+)\|(.+)$/);
  const m = d || t;
  if (!m) return null;
  const a = m[1];
  const b = m[2];
  if (a === me) return b;
  if (b === me) return a;
  return null;
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

function roleLabel(role: string | null | undefined) {
  if (!role) return "—";
  return getRoleDisplayName(role);
}

function normalizeCommRow(r: Record<string, unknown>): CommRow | null {
  if (typeof r.id !== "string") return null;
  return {
    id: r.id,
    subject: (r.subject as string) ?? null,
    body: (r.body as string) ?? null,
    sent_at: (r.sent_at as string) ?? null,
    recorded_by: (r.recorded_by as string) ?? null,
  };
}

function normalizePortalRow(r: Record<string, unknown>): PortalRow | null {
  if (typeof r.id !== "string" || typeof r.client_id !== "string") return null;
  return {
    id: r.id,
    client_id: r.client_id,
    sender_id: (r.sender_id as string) ?? "",
    sender_name: (r.sender_name as string) ?? null,
    sender_role: (r.sender_role as string) ?? null,
    message: (r.message as string) ?? "",
    created_at: (r.created_at as string) ?? null,
  };
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function renderAttachment(body: string): ReactNode {
  if (!body.startsWith(CHAT_FILE_PREFIX)) return null;

  const path = body.slice(CHAT_FILE_PREFIX.length).trim();
  if (!path) return <span className="text-xs opacity-80">Invalid attachment</span>;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const fileUrl = `${supabaseUrl}/storage/v1/object/public/chat-attachments/${encodeStoragePath(path)}`;

  const ext = path.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isVideo = ["mp4", "mov", "webm", "avi"].includes(ext);
  const isAudio = ["mp3", "m4a", "wav", "ogg"].includes(ext);
  const isGif = ext === "gif";

  if (isImage || isGif) {
    return (
      <div className="mt-1 max-w-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl}
          alt="attachment"
          className="max-h-48 max-w-full cursor-pointer rounded-xl object-cover transition-opacity hover:opacity-90"
          onClick={() => window.open(fileUrl, "_blank")}
        />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="mt-1 max-w-xs">
        <video
          src={fileUrl}
          controls
          className="max-h-48 max-w-full rounded-xl"
          preload="metadata"
        />
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="mt-1 w-48">
        <audio src={fileUrl} controls className="w-full rounded-lg" preload="metadata" />
      </div>
    );
  }

  const displayName = path.split("/").pop()?.replace(/^\d+_/, "") ?? path;

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex max-w-xs items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-200 dark:bg-[#242424] dark:text-slate-200 dark:hover:bg-[#243528]"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{displayName}</span>
      <ExternalLink className="h-3 w-3 shrink-0 text-gray-400 dark:text-slate-500" />
    </a>
  );
}

function renderMessageContent(body: string): ReactNode {
  if (!body) return null;

  if (body.startsWith("_ZB_GIF:")) {
    const url = body.replace("_ZB_GIF:", "").trim();
    if (!url) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="GIF"
        className="rounded-xl max-w-[180px] max-h-36 object-cover"
        loading="lazy"
      />
    );
  }

  if (body.startsWith(CHAT_FILE_PREFIX)) {
    return renderAttachment(body);
  }

  return (
    <p className="whitespace-pre-wrap break-words text-sm">{body}</p>
  );
}

const MessageBody = memo(({ text }: { text: string }) => {
  return renderMessageContent(text);
});

MessageBody.displayName = "MessageBody";

const TeamBubble = memo(({
  mine,
  text,
  senderName,
  timeIso,
}: {
  mine: boolean;
  text: string;
  senderName: string;
  timeIso: string | null | undefined;
}) => {
  const title =
    timeIso && !Number.isNaN(new Date(timeIso).getTime())
      ? formatDateTime(timeIso)
      : undefined;
  return (
    <div className={`flex w-full flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        title={title}
        className={`max-w-[calc(100vw-2.5rem)] sm:max-w-[85%] rounded-lg px-4 py-2.5 text-sm shadow-sm ${
          mine
            ? "rounded-br-md bg-[#A87830] text-[#161616]"
            : "rounded-bl-md border border-slate-200 bg-slate-100 text-slate-900 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]"
        }`}
      >
        <MessageBody text={text} />
      </div>
      <div
        className={`mt-1 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400 sm:max-w-[85%] ${
          mine ? "justify-end text-right" : ""
        }`}
      >
        <span className="font-medium text-slate-600 dark:text-slate-300">{senderName}</span>
        <ClientFormattedDate iso={timeIso} pattern="MMM d, h:mm a" fallback="" />
      </div>
    </div>
  );
});

TeamBubble.displayName = "TeamBubble";

export function CommunicationsHub() {
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [ready, setReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentRole, setCurrentRole] = useState("");

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [tab, setTab] = useState<HubTab>("team");
  const isNarrowHub = useMediaQuery("(max-width: 767px)");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [busy, setBusy] = useState(false);

  const tabRef = useRef(tab);
  const selectedPeerIdRef = useRef<string | null>(null);
  const selectedDeptNameRef = useRef<string | null>(null);
  const selectedClientIdRef = useRef<string | null>(null);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    setMobileView("list");
  }, [tab]);

  const peers = useMemo(
    () =>
      teamMembers.filter((m) => {
        if (m.id === currentUserId) return false;
        if (currentRole !== "dev" && isHiddenFromRole(m.email, currentRole)) {
          return false;
        }
        return true;
      }),
    [teamMembers, currentUserId, currentRole]
  );

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of teamMembers) {
      m[p.id] = p.full_name?.trim() || "—";
    }
    if (currentUserId) {
      m[currentUserId] = currentUserName;
    }
    return m;
  }, [teamMembers, currentUserId, currentUserName]);

  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [teamMessages, setTeamMessages] = useState<CommRow[]>([]);
  const [teamInput, setTeamInput] = useState("");

  const [selectedDeptName, setSelectedDeptName] = useState<string | null>(null);
  const [deptMessages, setDeptMessages] = useState<CommRow[]>([]);
  const [deptInput, setDeptInput] = useState("");

  const [teamSearch, setTeamSearch] = useState("");
  const deferredTeamSearch = useDeferredValue(teamSearch);
  const [teamPeerMeta, setTeamPeerMeta] = useState<
    Record<string, { lastAt: string | null; unread: number }>
  >({});
  const [deptChannelTime, setDeptChannelTime] = useState<Record<string, string>>({});
  const [deptUnreadMeta, setDeptUnreadMeta] = useState<Record<string, number>>({});
  const [metaVersion, setMetaVersion] = useState(0);

  const [clientSearch, setClientSearch] = useState("");
  const deferredClientSearch = useDeferredValue(clientSearch);
  const [clientInbox, setClientInbox] = useState<ClientInboxRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [portalMessages, setPortalMessages] = useState<PortalRow[]>([]);
  const [portalInput, setPortalInput] = useState("");

  const [dmPulsePeers, setDmPulsePeers] = useState<Record<string, boolean>>({});
  const [deptPulse, setDeptPulse] = useState<Record<string, boolean>>({});
  const [clientPulse, setClientPulse] = useState<Record<string, boolean>>({});

  const [teamTypingUsers, setTeamTypingUsers] = useState<string[]>([]);
  const [deptTypingUsers, setDeptTypingUsers] = useState<string[]>([]);
  const [portalTypingUsers, setPortalTypingUsers] = useState<string[]>([]);

  const [uploadingTeam, setUploadingTeam] = useState(false);
  const [uploadingDept, setUploadingDept] = useState(false);
  const [uploadingPortal, setUploadingPortal] = useState(false);

  const [showTeamEmoji, setShowTeamEmoji] = useState(false);
  const [showDeptEmoji, setShowDeptEmoji] = useState(false);
  const [showPortalEmoji, setShowPortalEmoji] = useState(false);

  const teamEndRef = useRef<HTMLDivElement | null>(null);
  const deptEndRef = useRef<HTMLDivElement | null>(null);
  const clientEndRef = useRef<HTMLDivElement | null>(null);

  const teamTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const deptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const portalTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const teamPresenceRef = useRef<RealtimeChannel | null>(null);
  const deptPresenceRef = useRef<RealtimeChannel | null>(null);
  const portalPresenceRef = useRef<RealtimeChannel | null>(null);
  const teamTypingThrottleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const teamTypingIdleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const deptTypingThrottleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const deptTypingIdleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const portalTypingThrottleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const portalTypingIdleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const inboxRefreshTimerRef = useRef<number | null>(null);

  const scrollTeamEnd = useCallback(() => {
    window.setTimeout(() => {
      teamEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);
  const scrollDeptEnd = useCallback(() => {
    window.setTimeout(() => {
      deptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);
  const scrollClientEnd = useCallback(() => {
    window.setTimeout(() => {
      clientEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => {
    selectedPeerIdRef.current = selectedPeerId;
  }, [selectedPeerId]);
  useEffect(() => {
    selectedDeptNameRef.current = selectedDeptName;
  }, [selectedDeptName]);
  useEffect(() => {
    selectedClientIdRef.current = selectedClientId;
  }, [selectedClientId]);

  const visibleDepartments = useMemo(() => {
    return ALL_DEPARTMENTS.filter((dept) => {
      if (dept.access === "all") return true;
      if (dept.access === "admin_dev") {
        return currentRole === "dev" || currentRole === "admin";
      }
      return false;
    });
  }, [currentRole]);

  useEffect(() => {
    if (visibleDepartments.length === 0) {
      setSelectedDeptName(null);
      return;
    }
    setSelectedDeptName((prev) => {
      if (prev && visibleDepartments.some((d) => d.name === prev)) return prev;
      return visibleDepartments[0]!.name;
    });
  }, [visibleDepartments]);

  useEffect(() => {
    const el = teamTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [teamInput]);

  useEffect(() => {
    const el = deptTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [deptInput]);

  useEffect(() => {
    const el = portalTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [portalInput]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: prof, error: pe } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();
      if (pe || !prof) {
        router.replace("/login");
        return;
      }
      const role = prof.role as string;
      if (role === "client") {
        router.replace("/portal");
        return;
      }

      if (cancelled) return;
      setCurrentUserId(user.id);
      setCurrentUserName(prof.full_name?.trim() || user.email || "You");
      setCurrentRole(role);

      const { data: teamRows, error: te } = await supabase
        .from("profiles")
        .select("id, full_name, role, email")
        .in("role", ["dev", "admin", "acct_manager", "attorney"])
        .eq("is_active", true)
        .neq("id", user.id)
        .order("full_name", { ascending: true, nullsFirst: false });

      if (te) {
        toast.error(toUserFacingError(te.message));
        setReady(true);
        return;
      }
      setTeamMembers((teamRows ?? []) as TeamMember[]);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, supabase, toast]);

  const loadTeamThread = useCallback(async () => {
    if (!currentUserId || !selectedPeerId) {
      setTeamMessages([]);
      return;
    }
    const s1 = directThreadSubject(currentUserId, selectedPeerId);
    const s2 = legacyTeamThreadSubject(currentUserId, selectedPeerId);
    const { data, error } = await supabase
      .from("communications")
      .select("id, subject, body, sent_at, recorded_by")
      .eq("type", "note")
      .eq("direction", "internal")
      .is("client_id", null)
      .in("subject", [s1, s2])
      .order("sent_at", { ascending: true });
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    setTeamMessages((data ?? []) as CommRow[]);
  }, [supabase, currentUserId, selectedPeerId, toast]);

  const loadDeptThread = useCallback(async () => {
    if (!selectedDeptName) {
      setDeptMessages([]);
      return;
    }
    const subject = deptSubject(selectedDeptName);
    const { data, error } = await supabase
      .from("communications")
      .select("id, subject, body, sent_at, recorded_by")
      .eq("type", "note")
      .eq("direction", "internal")
      .is("client_id", null)
      .eq("subject", subject)
      .order("sent_at", { ascending: true });
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    setDeptMessages((data ?? []) as CommRow[]);
  }, [supabase, selectedDeptName, toast]);

  const refreshTeamDeptMeta = useCallback(async () => {
    if (!currentUserId) return;
    // DMs: only threads involving this user. Dept channels: all messages on dept:* subjects.
    const { data, error } = await supabase
      .from("communications")
      .select("subject, sent_at, recorded_by")
      .eq("type", "note")
      .eq("direction", "internal")
      .is("client_id", null)
      .or(
        `recorded_by.eq.${currentUserId},subject.like.%${currentUserId}%,subject.like.dept:%`
      )
      .order("sent_at", { ascending: false })
      .limit(6000);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    const rows = (data ?? []) as {
      subject: string | null;
      sent_at: string | null;
      recorded_by: string | null;
    }[];
    const byPeer: Record<string, typeof rows> = {};
    const byDept: Record<string, typeof rows> = {};
    const deptTimes: Record<string, string> = {};
    for (const row of rows) {
      const sub = row.subject ?? "";
      if (sub.startsWith("dept:")) {
        const name = sub.slice(5);
        const t = row.sent_at as string;
        if (t && (!deptTimes[name] || new Date(t) > new Date(deptTimes[name]))) {
          deptTimes[name] = t;
        }
        if (!byDept[name]) byDept[name] = [];
        byDept[name].push(row);
        continue;
      }
      const peer = peerFromSubject(sub, currentUserId);
      if (!peer) continue;
      if (!byPeer[peer]) byPeer[peer] = [];
      byPeer[peer].push(row);
    }
    const meta: Record<string, { lastAt: string | null; unread: number }> = {};
    for (const peer of Object.keys(byPeer)) {
      const msgs = byPeer[peer];
      let lastAt: string | null = null;
      for (const m of msgs) {
        const t = m.sent_at;
        if (t && (!lastAt || new Date(t) > new Date(lastAt))) lastAt = t;
      }
      const lastRead = dmLastViewedMs(peer);
      let unread = 0;
      for (const m of msgs) {
        if (m.recorded_by === currentUserId) continue;
        const st = m.sent_at ? new Date(m.sent_at).getTime() : 0;
        if (st > lastRead) unread++;
      }
      meta[peer] = { lastAt, unread };
    }
    const deptUnread: Record<string, number> = {};
    for (const deptName of Object.keys(byDept)) {
      const msgs = byDept[deptName];
      const lastRead = deptLastViewedMs(deptName);
      let unread = 0;
      for (const m of msgs) {
        if (m.recorded_by === currentUserId) continue;
        const st = m.sent_at ? new Date(m.sent_at).getTime() : 0;
        if (st > lastRead) unread++;
      }
      deptUnread[deptName] = unread;
    }
    setTeamPeerMeta(meta);
    setDeptChannelTime(deptTimes);
    setDeptUnreadMeta(deptUnread);
  }, [currentUserId, supabase, toast]);

  const loadClientInbox = useCallback(async () => {
    if (!currentUserId) {
      setClientInbox([]);
      return;
    }
    const { data: unreadRows, error: ue } = await supabase
      .from("portal_messages")
      .select("client_id")
      .eq("is_read", false)
      .neq("sender_id", currentUserId);
    if (ue) {
      toast.error(toUserFacingError(ue.message));
      return;
    }
    const unreadByClient = new Map<string, number>();
    for (const r of unreadRows ?? []) {
      const cid = r.client_id as string;
      unreadByClient.set(cid, (unreadByClient.get(cid) ?? 0) + 1);
    }

    const { data: msgs, error } = await supabase
      .from("portal_messages")
      .select("client_id, message, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    const latestByClient = new Map<
      string,
      { preview: string; lastAt: string | null }
    >();
    for (const row of msgs ?? []) {
      const cid = row.client_id as string;
      if (latestByClient.has(cid)) continue;
      latestByClient.set(cid, {
        preview: (row.message as string)?.slice(0, 120) ?? "",
        lastAt: (row.created_at as string) ?? null,
      });
    }
    const idSet = new Set<string>([
      ...Array.from(unreadByClient.keys()),
      ...Array.from(latestByClient.keys()),
    ]);
    const ids = Array.from(idSet);
    if (ids.length === 0) {
      setClientInbox([]);
      return;
    }
    const { data: clients, error: ce } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .in("id", ids);
    if (ce) {
      toast.error(toUserFacingError(ce.message));
      return;
    }
    const nameByClient: Record<string, string> = {};
    for (const c of clients ?? []) {
      const id = c.id as string;
      nameByClient[id] =
        `${String(c.first_name ?? "").trim()} ${String(c.last_name ?? "").trim()}`.trim() ||
        "—";
    }
    const rows: ClientInboxRow[] = ids.map((clientId) => {
      const meta = latestByClient.get(clientId);
      return {
        clientId,
        displayName: nameByClient[clientId] ?? "—",
        lastPreview: meta?.preview ?? "",
        lastAt: meta?.lastAt ?? null,
        unreadCount: unreadByClient.get(clientId) ?? 0,
      };
    });
    rows.sort((a, b) => {
      const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      return tb - ta;
    });
    setClientInbox(rows);
  }, [supabase, toast, currentUserId]);

  const loadPortalThread = useCallback(async () => {
    if (!selectedClientId) {
      setPortalMessages([]);
      return;
    }
    const { data, error } = await supabase
      .from("portal_messages")
      .select(
        "id, client_id, sender_id, sender_name, sender_role, message, created_at"
      )
      .eq("client_id", selectedClientId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    setPortalMessages([...(data ?? [])].reverse() as PortalRow[]);
  }, [supabase, selectedClientId, toast]);

  const scheduleInboxRefresh = useCallback(() => {
    if (inboxRefreshTimerRef.current) {
      window.clearTimeout(inboxRefreshTimerRef.current);
    }
    inboxRefreshTimerRef.current = window.setTimeout(() => {
      void loadClientInbox();
      inboxRefreshTimerRef.current = null;
    }, 450);
  }, [loadClientInbox]);

  useEffect(() => {
    if (!ready || tab !== "team") return;
    void loadTeamThread();
  }, [ready, tab, loadTeamThread]);

  useEffect(() => {
    if (!ready || tab !== "departments") return;
    void loadDeptThread();
  }, [ready, tab, loadDeptThread]);

  useEffect(() => {
    if (!ready || !currentUserId) return;
    void refreshTeamDeptMeta();
  }, [ready, currentUserId, metaVersion, refreshTeamDeptMeta]);

  useEffect(() => {
    if (!selectedPeerId || !currentUserId) return;
    try {
      const now = new Date().toISOString();
      localStorage.setItem(DM_LAST_VIEWED_PREFIX + selectedPeerId, now);
      localStorage.removeItem(DM_LAST_VIEWED_LEGACY_PREFIX + selectedPeerId);
    } catch {
      /* ignore */
    }
    setMetaVersion((v) => v + 1);
  }, [selectedPeerId, currentUserId]);

  useEffect(() => {
    setDmPulsePeers(() => {
      const next: Record<string, boolean> = {};
      for (const [id, meta] of Object.entries(teamPeerMeta)) {
        if (meta.unread > 0) next[id] = true;
      }
      return next;
    });
  }, [teamPeerMeta]);

  useEffect(() => {
    if (!ready || tab !== "clients") return;
    void loadClientInbox();
  }, [ready, tab, loadClientInbox]);

  useEffect(() => {
    if (!ready || tab !== "clients" || !selectedClientId || !currentUserId) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase
        .from("portal_messages")
        .update({ is_read: true })
        .eq("client_id", selectedClientId)
        .neq("sender_id", currentUserId);
      if (cancelled) return;
      if (error) {
        toast.error(toUserFacingError(error.message));
        return;
      }
      setClientPulse((p) => ({ ...p, [selectedClientId]: false }));
      void loadClientInbox();
      void loadPortalThread();
    })();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    tab,
    selectedClientId,
    currentUserId,
    supabase,
    loadClientInbox,
    loadPortalThread,
    toast,
  ]);

  useEffect(() => {
    scrollTeamEnd();
  }, [selectedPeerId, scrollTeamEnd]);

  useEffect(() => {
    scrollTeamEnd();
  }, [teamMessages.length, selectedPeerId, scrollTeamEnd]);

  useEffect(() => {
    scrollDeptEnd();
  }, [selectedDeptName, scrollDeptEnd]);

  useEffect(() => {
    scrollDeptEnd();
  }, [deptMessages.length, selectedDeptName, scrollDeptEnd]);

  useEffect(() => {
    scrollClientEnd();
  }, [selectedClientId, scrollClientEnd]);

  useEffect(() => {
    scrollClientEnd();
  }, [portalMessages.length, selectedClientId, scrollClientEnd]);

  useEffect(() => {
    if (!ready || !currentUserId) return;

    const ch = supabase
      .channel("hub-communications-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "communications" },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          if (raw.type !== "note" || raw.direction !== "internal") return;
          if (raw.client_id != null) return;

          const row = normalizeCommRow(raw);
          if (!row) return;

          const subj = row.subject ?? "";
          const uid = currentUserId;

          if (subj.startsWith("dept:")) {
            const deptName = subj.slice(5);
            const viewingDept = tabRef.current === "departments" && selectedDeptNameRef.current === deptName;
            if (viewingDept) {
              setDeptMessages((prev) => {
                if (prev.some((m) => m.id === row.id)) return prev;
                return [...prev, row];
              });
              scrollDeptEnd();
              try {
                localStorage.setItem(
                  DEPT_LAST_VIEWED_PREFIX + deptName,
                  new Date().toISOString()
                );
              } catch {
                /* ignore */
              }
              setDeptUnreadMeta((prev) => ({ ...prev, [deptName]: 0 }));
              setDeptPulse((p) => ({ ...p, [deptName]: false }));
            } else if (row.recorded_by !== uid) {
              setDeptPulse((p) => ({ ...p, [deptName]: true }));
              setDeptUnreadMeta((prev) => ({
                ...prev,
                [deptName]: (prev[deptName] ?? 0) + 1,
              }));
            }
            setMetaVersion((v) => v + 1);

            if (row.recorded_by && row.recorded_by !== uid) {
              void (async () => {
                await supabase.from("notifications").insert({
                  user_id: uid,
                  type: "team_message",
                  title: deptName,
                  body: deptNotifPreview(row.body),
                  read: false,
                  action_url: "/communications",
                });
              })();
            }
            return;
          }

          const peer = peerFromSubject(subj, uid);
          if (!peer) return;

          const viewingDm =
            tabRef.current === "team" && selectedPeerIdRef.current === peer;
          const s1 = directThreadSubject(uid, peer);
          const s2 = legacyTeamThreadSubject(uid, peer);
          if (subj !== s1 && subj !== s2) return;

          if (
            row.recorded_by &&
            row.recorded_by !== uid &&
            (subj.startsWith("direct:") || subj.startsWith("team:")) &&
            subj.includes(uid)
          ) {
            const rawBody = row.body ?? "";
            void (async () => {
              const senderId = row.recorded_by as string;
              const { data: sender } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", senderId)
                .maybeSingle();
              await supabase.from("notifications").insert({
                user_id: uid,
                type: "team_message",
                title: `💬 ${sender?.full_name ?? "Team member"}`,
                body: dmNotifPreview(rawBody),
                read: false,
                action_url: "/communications",
              });
            })();
          }

          if (viewingDm) {
            setTeamMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, row];
            });
            scrollTeamEnd();
            try {
              const now = new Date().toISOString();
              localStorage.setItem(DM_LAST_VIEWED_PREFIX + peer, now);
              localStorage.removeItem(DM_LAST_VIEWED_LEGACY_PREFIX + peer);
            } catch {
              /* ignore */
            }
            setTeamPeerMeta((prev) => ({
              ...prev,
              [peer]: {
                lastAt: row.sent_at ?? prev[peer]?.lastAt ?? null,
                unread: 0,
              },
            }));
          } else if (row.recorded_by !== uid) {
            setTeamPeerMeta((prev) => {
              const cur = prev[peer] ?? { lastAt: null, unread: 0 };
              const nextLast =
                row.sent_at &&
                (!cur.lastAt || new Date(row.sent_at) > new Date(cur.lastAt))
                  ? row.sent_at
                  : cur.lastAt;
              return {
                ...prev,
                [peer]: { lastAt: nextLast, unread: cur.unread + 1 },
              };
            });
          }
          setMetaVersion((v) => v + 1);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [ready, currentUserId, supabase, scrollTeamEnd, scrollDeptEnd]);

  useEffect(() => {
    if (!ready || !currentUserId) return;

    const ch = supabase
      .channel("hub-portal-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "portal_messages" },
        (payload) => {
          const row = normalizePortalRow(payload.new as Record<string, unknown>);
          if (!row) return;
          const cid = row.client_id;
          const viewing =
            tabRef.current === "clients" && selectedClientIdRef.current === cid;
          if (viewing) {
            setPortalMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, row];
            });
            scrollClientEnd();
          } else {
            setClientPulse((p) => ({ ...p, [cid]: true }));
            scheduleInboxRefresh();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [ready, currentUserId, supabase, scheduleInboxRefresh, scrollClientEnd]);

  useEffect(() => {
    if (!ready || tab !== "team" || !currentUserId || !selectedPeerId) {
      setTeamTypingUsers([]);
      return;
    }
    const presenceDebounceRef = {
      current: null as ReturnType<typeof setTimeout> | null,
    };
    const id = `typing-dm-${[currentUserId, selectedPeerId].sort().join("-")}`;
    const ch = supabase.channel(id, {
      config: { presence: { key: currentUserId } },
    });

    const handlePresenceSync = () => {
      if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current);
      presenceDebounceRef.current = setTimeout(() => {
        presenceDebounceRef.current = null;
        const state = ch.presenceState();
        const names: string[] = [];
        for (const k of Object.keys(state)) {
          const metas = state[k] as {
            typing?: boolean;
            full_name?: string;
            user_id?: string;
          }[];
          for (const meta of metas) {
            if (meta?.typing && meta.user_id !== currentUserId) {
              names.push(meta.full_name ?? "Teammate");
            }
          }
        }
        const typing = Array.from(new Set(names));
        setTeamTypingUsers((prev) => {
          const same =
            prev.length === typing.length && prev.every((n, i) => n === typing[i]);
          return same ? prev : typing;
        });
      }, 50);
    };

    ch.on("presence", { event: "sync" }, handlePresenceSync);
    ch.on("presence", { event: "join" }, handlePresenceSync);
    ch.on("presence", { event: "leave" }, handlePresenceSync);

    void ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          user_id: currentUserId,
          full_name: currentUserName,
          typing: false,
        });
      }
    });
    teamPresenceRef.current = ch;
    return () => {
      if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current);
      void supabase.removeChannel(ch);
      teamPresenceRef.current = null;
      setTeamTypingUsers([]);
    };
  }, [ready, tab, currentUserId, selectedPeerId, currentUserName, supabase]);

  useEffect(() => {
    if (!ready || tab !== "departments" || !selectedDeptName || !currentUserId) {
      setDeptTypingUsers([]);
      return;
    }
    const presenceDebounceRef = {
      current: null as ReturnType<typeof setTimeout> | null,
    };
    const id = `typing-dept-${encodeURIComponent(selectedDeptName)}`;
    const ch = supabase.channel(id, {
      config: { presence: { key: currentUserId } },
    });

    const handlePresenceSync = () => {
      if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current);
      presenceDebounceRef.current = setTimeout(() => {
        presenceDebounceRef.current = null;
        const state = ch.presenceState();
        const names: string[] = [];
        for (const k of Object.keys(state)) {
          const metas = state[k] as {
            typing?: boolean;
            full_name?: string;
            user_id?: string;
          }[];
          for (const meta of metas) {
            if (meta?.typing && meta.user_id !== currentUserId) {
              names.push(meta.full_name ?? "Teammate");
            }
          }
        }
        const typing = Array.from(new Set(names));
        setDeptTypingUsers((prev) => {
          const same =
            prev.length === typing.length && prev.every((n, i) => n === typing[i]);
          return same ? prev : typing;
        });
      }, 50);
    };

    ch.on("presence", { event: "sync" }, handlePresenceSync);
    ch.on("presence", { event: "join" }, handlePresenceSync);
    ch.on("presence", { event: "leave" }, handlePresenceSync);

    void ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          user_id: currentUserId,
          full_name: currentUserName,
          typing: false,
        });
      }
    });
    deptPresenceRef.current = ch;
    return () => {
      if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current);
      void supabase.removeChannel(ch);
      deptPresenceRef.current = null;
      setDeptTypingUsers([]);
    };
  }, [ready, tab, selectedDeptName, currentUserId, currentUserName, supabase]);

  useEffect(() => {
    if (!ready || tab !== "clients" || !selectedClientId || !currentUserId) {
      setPortalTypingUsers([]);
      return;
    }
    const presenceDebounceRef = {
      current: null as ReturnType<typeof setTimeout> | null,
    };
    const id = `typing-portal-${selectedClientId}`;
    const ch = supabase.channel(id, {
      config: { presence: { key: currentUserId } },
    });

    const handlePresenceSync = () => {
      if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current);
      presenceDebounceRef.current = setTimeout(() => {
        presenceDebounceRef.current = null;
        const state = ch.presenceState();
        const names: string[] = [];
        for (const k of Object.keys(state)) {
          const metas = state[k] as {
            typing?: boolean;
            full_name?: string;
            user_id?: string;
          }[];
          for (const meta of metas) {
            if (meta?.typing && meta.user_id !== currentUserId) {
              names.push(meta.full_name ?? "Teammate");
            }
          }
        }
        const typing = Array.from(new Set(names));
        setPortalTypingUsers((prev) => {
          const same =
            prev.length === typing.length && prev.every((n, i) => n === typing[i]);
          return same ? prev : typing;
        });
      }, 50);
    };

    ch.on("presence", { event: "sync" }, handlePresenceSync);
    ch.on("presence", { event: "join" }, handlePresenceSync);
    ch.on("presence", { event: "leave" }, handlePresenceSync);

    void ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          user_id: currentUserId,
          full_name: currentUserName,
          typing: false,
        });
      }
    });
    portalPresenceRef.current = ch;
    return () => {
      if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current);
      void supabase.removeChannel(ch);
      portalPresenceRef.current = null;
      setPortalTypingUsers([]);
    };
  }, [ready, tab, selectedClientId, currentUserId, currentUserName, supabase]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest?.("[data-emoji-popover]")) {
        setShowTeamEmoji(false);
        setShowDeptEmoji(false);
        setShowPortalEmoji(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const uploadChatFile = useCallback(
    async (file: File): Promise<string | null> => {
      if (!currentUserId) return null;
      const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(0, 180);
      const path = `${currentUserId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error(toUserFacingError(error.message));
        return null;
      }
      return `${CHAT_FILE_PREFIX}${path}`;
    },
    [currentUserId, supabase, toast]
  );

  async function sendTeamMessage(e?: React.FormEvent | React.KeyboardEvent) {
    e?.preventDefault?.();
    if (!currentUserId || !selectedPeerId || !teamInput.trim()) return;

    const tpCh = teamPresenceRef.current;
    if (tpCh && currentUserId) {
      void tpCh.track({
        typing: false,
        user_id: currentUserId,
        full_name: currentUserName,
      });
    }
    if (teamTypingThrottleRef.current) {
      clearTimeout(teamTypingThrottleRef.current);
      teamTypingThrottleRef.current = undefined;
    }
    if (teamTypingIdleRef.current) {
      clearTimeout(teamTypingIdleRef.current);
      teamTypingIdleRef.current = undefined;
    }

    setBusy(true);
    const subject = directThreadSubject(currentUserId, selectedPeerId);
    const body = teamInput.trim();
    const { data, error } = await supabase
      .from("communications")
      .insert({
        type: "note",
        direction: "internal",
        subject,
        body,
        recorded_by: currentUserId,
        sent_at: new Date().toISOString(),
      })
      .select("id, subject, body, sent_at, recorded_by")
      .single();
    setBusy(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    setTeamInput("");
    if (data) {
      setTeamMessages((prev) => {
        const row = data as CommRow;
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
      setMetaVersion((v) => v + 1);
      scrollTeamEnd();
    } else {
      void loadTeamThread();
    }
  }

  async function sendDeptMessage(e?: React.FormEvent | React.KeyboardEvent) {
    e?.preventDefault?.();
    if (!selectedDeptName || !deptInput.trim()) return;

    const dpCh = deptPresenceRef.current;
    if (dpCh && currentUserId) {
      void dpCh.track({
        typing: false,
        user_id: currentUserId,
        full_name: currentUserName,
      });
    }
    if (deptTypingThrottleRef.current) {
      clearTimeout(deptTypingThrottleRef.current);
      deptTypingThrottleRef.current = undefined;
    }
    if (deptTypingIdleRef.current) {
      clearTimeout(deptTypingIdleRef.current);
      deptTypingIdleRef.current = undefined;
    }

    setBusy(true);
    const body = deptInput.trim();
    const { data, error } = await supabase
      .from("communications")
      .insert({
        type: "note",
        direction: "internal",
        subject: deptSubject(selectedDeptName),
        body,
        recorded_by: currentUserId!,
        sent_at: new Date().toISOString(),
      })
      .select("id, subject, body, sent_at, recorded_by")
      .single();
    setBusy(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    setDeptInput("");
    if (data) {
      setDeptMessages((prev) => {
        const row = data as CommRow;
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
      setMetaVersion((v) => v + 1);
      scrollDeptEnd();
    } else {
      void loadDeptThread();
    }
  }

  async function sendPortalMessage(e?: React.FormEvent | React.KeyboardEvent) {
    e?.preventDefault?.();
    if (!currentUserId || !selectedClientId || !portalInput.trim()) return;

    const ppCh = portalPresenceRef.current;
    if (ppCh && currentUserId) {
      void ppCh.track({
        typing: false,
        user_id: currentUserId,
        full_name: currentUserName,
      });
    }
    if (portalTypingThrottleRef.current) {
      clearTimeout(portalTypingThrottleRef.current);
      portalTypingThrottleRef.current = undefined;
    }
    if (portalTypingIdleRef.current) {
      clearTimeout(portalTypingIdleRef.current);
      portalTypingIdleRef.current = undefined;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from("portal_messages")
      .insert({
        client_id: selectedClientId,
        sender_id: currentUserId,
        sender_name: currentUserName,
        sender_role: currentRole,
        message: portalInput.trim(),
      })
      .select(
        "id, client_id, sender_id, sender_name, sender_role, message, created_at"
      )
      .single();
    setBusy(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    setPortalInput("");
    if (data) {
      setPortalMessages((prev) => {
        const row = data as PortalRow;
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
      scrollClientEnd();
      void loadClientInbox();
    } else {
      void loadPortalThread();
      void loadClientInbox();
    }
  }

  function throttleTeamTyping() {
    const ch = teamPresenceRef.current;
    if (!ch || !currentUserId) return;
    if (!teamTypingThrottleRef.current) {
      void ch.track({
        typing: true,
        user_id: currentUserId,
        full_name: currentUserName,
      });
      teamTypingThrottleRef.current = setTimeout(() => {
        teamTypingThrottleRef.current = undefined;
      }, 2000);
    }
    if (teamTypingIdleRef.current) clearTimeout(teamTypingIdleRef.current);
    teamTypingIdleRef.current = setTimeout(() => {
      teamTypingIdleRef.current = undefined;
      void ch.track({
        typing: false,
        user_id: currentUserId,
        full_name: currentUserName,
      });
    }, 2500);
  }

  function throttleDeptTyping() {
    const ch = deptPresenceRef.current;
    if (!ch || !currentUserId) return;
    if (!deptTypingThrottleRef.current) {
      void ch.track({
        typing: true,
        user_id: currentUserId,
        full_name: currentUserName,
      });
      deptTypingThrottleRef.current = setTimeout(() => {
        deptTypingThrottleRef.current = undefined;
      }, 2000);
    }
    if (deptTypingIdleRef.current) clearTimeout(deptTypingIdleRef.current);
    deptTypingIdleRef.current = setTimeout(() => {
      deptTypingIdleRef.current = undefined;
      void ch.track({
        typing: false,
        user_id: currentUserId,
        full_name: currentUserName,
      });
    }, 2500);
  }

  function throttlePortalTyping() {
    const ch = portalPresenceRef.current;
    if (!ch || !currentUserId) return;
    if (!portalTypingThrottleRef.current) {
      void ch.track({
        typing: true,
        user_id: currentUserId,
        full_name: currentUserName,
      });
      portalTypingThrottleRef.current = setTimeout(() => {
        portalTypingThrottleRef.current = undefined;
      }, 2000);
    }
    if (portalTypingIdleRef.current) clearTimeout(portalTypingIdleRef.current);
    portalTypingIdleRef.current = setTimeout(() => {
      portalTypingIdleRef.current = undefined;
      void ch.track({
        typing: false,
        user_id: currentUserId,
        full_name: currentUserName,
      });
    }, 2500);
  }

  const filteredClientInbox = useMemo(() => {
    const q = deferredClientSearch.trim().toLowerCase();
    if (!q) return clientInbox;
    return clientInbox.filter((row) => row.displayName.toLowerCase().includes(q));
  }, [clientInbox, deferredClientSearch]);

  const teamListPeers = useMemo(() => {
    const q = deferredTeamSearch.trim().toLowerCase();
    const list = peers.filter((p) => {
      const name = (nameById[p.id] ?? "").toLowerCase();
      return !q || name.includes(q);
    });
    list.sort((a, b) => {
      const ta = teamPeerMeta[a.id]?.lastAt
        ? new Date(teamPeerMeta[a.id].lastAt!).getTime()
        : 0;
      const tb = teamPeerMeta[b.id]?.lastAt
        ? new Date(teamPeerMeta[b.id].lastAt!).getTime()
        : 0;
      return tb - ta;
    });
    return list;
  }, [peers, deferredTeamSearch, nameById, teamPeerMeta]);


  if (!ready || !currentUserId) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 dark:border-[#2E2E2E]">
        {(
          [
            ["team", "Team Chat"],
            ["departments", "Departments"],
            ["clients", "Client Messages"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === id
                ? "bg-[#A87830] text-[#161616] shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-[#E8EAEE] dark:hover:bg-[#242424]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "team" ? (
        <div className="flex min-h-[min(520px,82dvh)] flex-1 flex-col gap-0 overflow-visible rounded-xl border border-slate-200 md:min-h-[520px] md:flex-row dark:border-[#2E2E2E]">
          <aside
            className={`flex w-full min-h-0 shrink-0 flex-col overflow-hidden border-slate-200 bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#121212] md:max-h-none md:max-w-[280px] md:border-r ${
              isNarrowHub && mobileView === "chat" ? "hidden md:flex" : "flex"
            } max-h-[44vh] border-b md:border-b-0`}
          >
            <p className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-[#2E2E2E] dark:text-[#A87830]">
              Team
            </p>
            <div className="border-b border-slate-200 p-2 dark:border-[#2E2E2E]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search team…"
                  aria-label="Search team members"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#A87830] focus:outline-none focus:ring-1 focus:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-[#E8EAEE]"
                />
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto md:max-h-[min(70vh,560px)]">
              {teamListPeers.map((m) => {
                const label = m.full_name?.trim() || "—";
                const unread = teamPeerMeta[m.id]?.unread ?? 0;
                const pulse = dmPulsePeers[m.id];
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPeerId(m.id);
                        try {
                          const now = new Date().toISOString();
                          localStorage.setItem(DM_LAST_VIEWED_PREFIX + m.id, now);
                          localStorage.removeItem(DM_LAST_VIEWED_LEGACY_PREFIX + m.id);
                        } catch {
                          /* ignore */
                        }
                        if (isNarrowHub) setMobileView("chat");
                      }}
                      className={`flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                        selectedPeerId === m.id
                          ? "bg-[#A87830]/20 font-semibold text-[#121212] dark:bg-[#A87830]/25 dark:text-[#E8EAEE]"
                          : "text-slate-800 hover:bg-white dark:text-[#E8EAEE] dark:hover:bg-[#1C1C1C]"
                      }`}
                    >
                      <span
                        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: "#A87830" }}
                      >
                        {getInitials(label)}
                        {pulse ? (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-[#A87830] ring-2 ring-white dark:ring-[#121212]" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="block min-w-0 flex-1 truncate font-medium">{label}</span>
                          {unread > 0 || pulse ? (
                            <span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#A87830] px-1 text-xs font-bold text-[#161616]">
                              {unread > 0 ? (unread > 99 ? "99+" : unread) : "!"}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-visible bg-white dark:bg-[#1C1C1C] ${
              isNarrowHub && mobileView === "list" ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 dark:border-[#2E2E2E] md:px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {isNarrowHub && mobileView === "chat" ? (
                  <button
                    type="button"
                    onClick={() => setMobileView("list")}
                    aria-label="Back to list"
                    className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 md:hidden dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
                  >
                    ← Back
                  </button>
                ) : null}
                <h2 className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-[#E8EAEE]">
                  {selectedPeerId ? nameById[selectedPeerId] ?? "Chat" : "Direct message"}
                </h2>
              </div>
            </div>
            <div className="flex min-h-[300px] flex-1 flex-col gap-4 overflow-y-auto p-4">
              {!selectedPeerId ? (
                <p className="text-center text-sm text-slate-500 dark:text-[#A87830]">
                  Select a team member to start chatting
                </p>
              ) : teamMessages.length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-[#A87830]">
                  No messages yet. Say hello below.
                </p>
              ) : (
                teamMessages.map((msg) => {
                  const mine = msg.recorded_by === currentUserId;
                  return (
                    <TeamBubble
                      key={msg.id}
                      mine={mine}
                      text={msg.body ?? ""}
                      senderName={nameById[msg.recorded_by ?? ""] ?? "—"}
                      timeIso={msg.sent_at}
                    />
                  );
                })
              )}
              <div ref={teamEndRef} />
            </div>
            <form onSubmit={sendTeamMessage} className="border-t border-gray-100 p-3 dark:border-[#2E2E2E]">
              {teamTypingUsers.length > 0 ? (
                <div className="mb-2 flex items-end gap-2 px-1">
                  <div className="flex items-center gap-1 rounded-lg rounded-bl-sm bg-gray-100 px-4 py-3 dark:bg-[#242424]">
                    <span
                      className="h-2 w-2 rounded-full bg-gray-400 dark:bg-[#A87830]"
                      style={{ animation: "typingDot 1.4s infinite", animationDelay: "0ms" }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-gray-400 dark:bg-[#A87830]"
                      style={{ animation: "typingDot 1.4s infinite", animationDelay: "200ms" }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-gray-400 dark:bg-[#A87830]"
                      style={{ animation: "typingDot 1.4s infinite", animationDelay: "400ms" }}
                    />
                  </div>
                  <span className="mb-1 text-xs text-gray-400 dark:text-slate-500">
                    {teamTypingUsers.join(", ")} typing...
                  </span>
                </div>
              ) : null}
              <div
                className="rounded-xl border border-gray-200 bg-white transition-colors focus-within:border-[#A87830] focus-within:ring-1 focus-within:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#121212] dark:focus-within:border-[#A87830] dark:focus-within:ring-[#A87830]"
                data-emoji-popover
              >
                <textarea
                  ref={teamTextareaRef}
                  value={teamInput}
                  onChange={(e) => {
                    setTeamInput(e.target.value);
                    throttleTeamTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendTeamMessage(e as unknown as React.FormEvent);
                    }
                  }}
                  disabled={!selectedPeerId || busy}
                  placeholder="Type a message... (Enter to send)"
                  aria-label="Type a message to team"
                  rows={1}
                  className="max-h-32 min-h-[44px] w-full resize-none rounded-t-xl bg-transparent px-4 pb-2 pt-3 text-sm text-slate-900 focus:outline-none dark:text-[#E8EAEE]"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                />
                <div className="flex items-center justify-between border-t border-gray-100 px-3 pb-2 dark:border-[#2E2E2E]">
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <button
                        type="button"
                        title="Add emoji"
                        aria-label="Add emoji"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTeamEmoji((v) => !v);
                          setShowDeptEmoji(false);
                          setShowPortalEmoji(false);
                        }}
                        className="rounded-lg p-1.5 text-base leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-[#242424] dark:hover:text-slate-300"
                      >
                        😊
                      </button>
                      {showTeamEmoji ? (
                        <div className="absolute bottom-9 left-0 z-50 grid w-48 grid-cols-6 gap-0.5 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
                          {COMMON_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              aria-label={`Add ${emoji} emoji`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setTeamInput((prev) => prev + emoji);
                                setShowTeamEmoji(false);
                              }}
                              className="rounded-lg p-1 text-lg leading-none transition-colors hover:bg-gray-100 dark:hover:bg-[#242424]"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <label
                      title="Attach file"
                      aria-label="Attach file"
                      className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-[#242424] dark:hover:text-slate-300"
                    >
                      <input
                        type="file"
                        className="hidden"
                        accept="*/*"
                        disabled={!selectedPeerId || busy}
                        onChange={async (ev) => {
                          const f = ev.target.files?.[0];
                          ev.target.value = "";
                          if (!f) return;
                          setUploadingTeam(true);
                          try {
                            const marker = await uploadChatFile(f);
                            if (marker)
                              setTeamInput((prev) => (prev ? `${prev}\n` : "") + marker);
                          } finally {
                            setUploadingTeam(false);
                          }
                        }}
                      />
                      <PaperclipIcon />
                    </label>
                  </div>
                  <button
                    type="button"
                    title="Send message"
                    aria-label="Send message"
                    onClick={() => void sendTeamMessage()}
                    disabled={
                      !selectedPeerId || busy || (!teamInput.trim() && !uploadingTeam)
                    }
                    className="flex items-center justify-center rounded-lg bg-[#A87830] p-2 text-[#161616] transition-colors hover:bg-[#8C6428] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy || uploadingTeam ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendPlaneIcon />
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {tab === "departments" ? (
        <div className="flex min-h-[min(520px,82dvh)] flex-1 flex-col gap-0 overflow-visible rounded-xl border border-slate-200 md:min-h-[520px] md:flex-row dark:border-[#2E2E2E]">
          <aside
            className={`flex w-full min-h-0 shrink-0 flex-col overflow-hidden border-slate-200 bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#121212] md:max-h-none md:max-w-[260px] md:border-r ${
              isNarrowHub && mobileView === "chat" ? "hidden md:flex" : "flex"
            } max-h-[44vh] border-b md:border-b-0`}
          >
            <p className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-[#2E2E2E] dark:text-[#A87830]">
              Channels
            </p>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {visibleDepartments.map((d) => (
                <li key={d.name}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDeptName(d.name);
                      try {
                        localStorage.setItem(
                          DEPT_LAST_VIEWED_PREFIX + d.name,
                          new Date().toISOString()
                        );
                      } catch {
                        /* ignore */
                      }
                      setDeptPulse((p) => ({ ...p, [d.name]: false }));
                      setDeptUnreadMeta((prev) => ({ ...prev, [d.name]: 0 }));
                      if (isNarrowHub) setMobileView("chat");
                    }}
                    className={`flex min-h-11 w-full px-3 py-2.5 text-left text-sm transition ${
                      selectedDeptName === d.name
                        ? "bg-[#A87830]/20 font-semibold text-[#121212] dark:bg-[#A87830]/25 dark:text-[#E8EAEE]"
                        : "text-slate-800 hover:bg-white dark:text-[#E8EAEE] dark:hover:bg-[#1C1C1C]"
                    }`}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span>
                          <span className="mr-2">{d.emoji}</span>
                          {d.name}
                        </span>
                        {(deptUnreadMeta[d.name] ?? 0) > 0 ? (
                          <span className="inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#A87830] px-1 text-[10px] font-bold leading-none text-[#161616]">
                            {(deptUnreadMeta[d.name] ?? 0) > 99
                              ? "99+"
                              : deptUnreadMeta[d.name]}
                          </span>
                        ) : deptPulse[d.name] ? (
                          <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#A87830]" />
                        ) : null}
                      </span>
                      <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                        <ClientFormattedDate
                          iso={deptChannelTime[d.name] ?? null}
                          pattern="MMM d, h:mm a"
                          fallback="No messages yet"
                        />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-visible bg-white dark:bg-[#1C1C1C] ${
              isNarrowHub && mobileView === "list" ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 dark:border-[#2E2E2E] md:px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {isNarrowHub && mobileView === "chat" ? (
                  <button
                    type="button"
                    onClick={() => setMobileView("list")}
                    aria-label="Back to list"
                    className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 md:hidden dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
                  >
                    ← Back
                  </button>
                ) : null}
                <h2 className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-[#E8EAEE]">
                  {selectedDeptName ?? "—"}
                </h2>
              </div>
            </div>
            <div className="flex min-h-[300px] flex-1 flex-col gap-4 overflow-y-auto p-4">
              {deptMessages.length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-[#A87830]">
                  No messages in this channel yet
                </p>
              ) : (
                deptMessages.map((msg) => {
                  const mine = msg.recorded_by === currentUserId;
                  return (
                    <TeamBubble
                      key={msg.id}
                      mine={mine}
                      text={msg.body ?? ""}
                      senderName={nameById[msg.recorded_by ?? ""] ?? "—"}
                      timeIso={msg.sent_at}
                    />
                  );
                })
              )}
              <div ref={deptEndRef} />
            </div>
            <form onSubmit={sendDeptMessage} className="border-t border-gray-100 p-3 dark:border-[#2E2E2E]">
              {deptTypingUsers.length > 0 ? (
                <div className="mb-2 flex items-end gap-2 px-1">
                  <div className="flex items-center gap-1 rounded-lg rounded-bl-sm bg-gray-100 px-4 py-3 dark:bg-[#242424]">
                    <span
                      className="h-2 w-2 rounded-full bg-gray-400 dark:bg-[#A87830]"
                      style={{ animation: "typingDot 1.4s infinite", animationDelay: "0ms" }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-gray-400 dark:bg-[#A87830]"
                      style={{ animation: "typingDot 1.4s infinite", animationDelay: "200ms" }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-gray-400 dark:bg-[#A87830]"
                      style={{ animation: "typingDot 1.4s infinite", animationDelay: "400ms" }}
                    />
                  </div>
                  <span className="mb-1 text-xs text-gray-400 dark:text-slate-500">
                    {deptTypingUsers.join(", ")} typing...
                  </span>
                </div>
              ) : null}
              <div
                className="rounded-xl border border-gray-200 bg-white transition-colors focus-within:border-[#A87830] focus-within:ring-1 focus-within:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#121212] dark:focus-within:border-[#A87830] dark:focus-within:ring-[#A87830]"
                data-emoji-popover
              >
                <textarea
                  ref={deptTextareaRef}
                  value={deptInput}
                  onChange={(e) => {
                    setDeptInput(e.target.value);
                    throttleDeptTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendDeptMessage(e as unknown as React.FormEvent);
                    }
                  }}
                  disabled={!selectedDeptName || busy}
                  placeholder="Type a message... (Enter to send)"
                  aria-label="Type a message to department"
                  rows={1}
                  className="max-h-32 min-h-[44px] w-full resize-none rounded-t-xl bg-transparent px-4 pb-2 pt-3 text-sm text-slate-900 focus:outline-none dark:text-[#E8EAEE]"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                />
                <div className="flex items-center justify-between border-t border-gray-100 px-3 pb-2 dark:border-[#2E2E2E]">
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <button
                        type="button"
                        title="Add emoji"
                        aria-label="Add emoji"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeptEmoji((v) => !v);
                          setShowTeamEmoji(false);
                          setShowPortalEmoji(false);
                        }}
                        className="rounded-lg p-1.5 text-base leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-[#242424] dark:hover:text-slate-300"
                      >
                        😊
                      </button>
                      {showDeptEmoji ? (
                        <div className="absolute bottom-9 left-0 z-50 grid w-48 grid-cols-6 gap-0.5 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
                          {COMMON_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              aria-label={`Add ${emoji} emoji`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setDeptInput((prev) => prev + emoji);
                                setShowDeptEmoji(false);
                              }}
                              className="rounded-lg p-1 text-lg leading-none transition-colors hover:bg-gray-100 dark:hover:bg-[#242424]"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <label
                      title="Attach file"
                      aria-label="Attach file"
                      className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-[#242424] dark:hover:text-slate-300"
                    >
                      <input
                        type="file"
                        className="hidden"
                        accept="*/*"
                        disabled={!selectedDeptName || busy}
                        onChange={async (ev) => {
                          const f = ev.target.files?.[0];
                          ev.target.value = "";
                          if (!f) return;
                          setUploadingDept(true);
                          try {
                            const marker = await uploadChatFile(f);
                            if (marker)
                              setDeptInput((prev) => (prev ? `${prev}\n` : "") + marker);
                          } finally {
                            setUploadingDept(false);
                          }
                        }}
                      />
                      <PaperclipIcon />
                    </label>
                  </div>
                  <button
                    type="button"
                    title="Send message"
                    aria-label="Send message"
                    onClick={() => void sendDeptMessage()}
                    disabled={
                      !selectedDeptName || busy || (!deptInput.trim() && !uploadingDept)
                    }
                    className="flex items-center justify-center rounded-lg bg-[#A87830] p-2 text-[#161616] transition-colors hover:bg-[#8C6428] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy || uploadingDept ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendPlaneIcon />
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {tab === "clients" ? (
        <div className="flex min-h-[min(520px,82dvh)] flex-1 flex-col gap-0 overflow-visible rounded-xl border border-slate-200 md:min-h-[520px] md:flex-row dark:border-[#2E2E2E]">
          <aside
            className={`flex w-full min-h-0 shrink-0 flex-col overflow-hidden border-slate-200 bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#121212] md:max-h-none md:max-w-[300px] md:border-r ${
              isNarrowHub && mobileView === "chat" ? "hidden md:flex" : "flex"
            } max-h-[44vh] border-b md:border-b-0`}
          >
            <p className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-[#2E2E2E] dark:text-[#A87830]">
              Clients
            </p>
            <div className="border-b border-slate-200 p-2 dark:border-[#2E2E2E]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search clients…"
                  aria-label="Search clients"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#A87830] focus:outline-none focus:ring-1 focus:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-[#E8EAEE]"
                />
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto md:max-h-[min(65vh,520px)]">
              {filteredClientInbox.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No clients with portal messages yet.
                </li>
              ) : (
                filteredClientInbox.map((row) => (
                  <li key={row.clientId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientId(row.clientId);
                        if (isNarrowHub) setMobileView("chat");
                      }}
                      className={`flex min-h-11 w-full px-3 py-2.5 text-left text-sm transition ${
                        selectedClientId === row.clientId
                          ? "bg-[#A87830]/20 font-semibold dark:bg-[#A87830]/25"
                          : "hover:bg-white dark:hover:bg-[#1C1C1C]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {clientPulse[row.clientId] ? (
                          <span
                            className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#A87830]"
                            aria-hidden
                          />
                        ) : null}
                        <span className="block min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-[#E8EAEE]">
                          {row.displayName}
                        </span>
                        {row.unreadCount > 0 ? (
                          <span className="inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#A87830] px-1 text-[10px] font-bold leading-none text-[#161616]">
                            {row.unreadCount > 99 ? "99+" : row.unreadCount}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {row.lastPreview}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        <ClientFormattedDate
                          iso={row.lastAt}
                          pattern="MMM d, h:mm a"
                          fallback=""
                        />
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>
          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-visible bg-white dark:bg-[#1C1C1C] ${
              isNarrowHub && mobileView === "list" ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 dark:border-[#2E2E2E] md:px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {isNarrowHub && mobileView === "chat" ? (
                  <button
                    type="button"
                    onClick={() => setMobileView("list")}
                    aria-label="Back to list"
                    className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 md:hidden dark:border-[#2E2E2E] dark:text-slate-200 dark:hover:bg-[#242424]"
                  >
                    ← Back
                  </button>
                ) : null}
                <h2 className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-[#E8EAEE]">
                  {selectedClientId
                    ? clientInbox.find((c) => c.clientId === selectedClientId)?.displayName ??
                      "Client"
                    : "Portal messages"}
                </h2>
              </div>
            </div>
            <div className="flex min-h-[300px] flex-1 flex-col gap-4 overflow-y-auto p-4">
              {!selectedClientId ? (
                <p className="text-center text-sm text-slate-500 dark:text-[#A87830]">
                  Select a client to view their messages
                </p>
              ) : portalMessages.length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-[#A87830]">
                  No messages yet.
                </p>
              ) : (
                portalMessages.map((msg) => {
                  const mine = msg.sender_id === currentUserId;
                  const bubbleTitle =
                    msg.created_at && !Number.isNaN(new Date(msg.created_at).getTime())
                      ? formatDateTime(msg.created_at)
                      : undefined;
                  return (
                    <div
                      key={msg.id}
                      className={`flex w-full flex-col ${mine ? "items-end" : "items-start"}`}
                    >
                      <div
                        title={bubbleTitle}
                        className={`max-w-[calc(100vw-2.5rem)] rounded-lg px-4 py-2.5 text-sm shadow-sm sm:max-w-[85%] ${
                          mine
                            ? "rounded-br-md bg-[#A87830] text-[#161616]"
                            : "rounded-bl-md border border-slate-200 bg-slate-100 text-slate-900 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]"
                        }`}
                      >
                        <MessageBody text={msg.message} />
                      </div>
                      <div
                        className={`mt-1 flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400 sm:max-w-[85%] ${
                          mine ? "justify-end" : ""
                        }`}
                      >
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {msg.sender_name ?? "—"}
                        </span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:bg-[#2E2E2E] dark:text-[#A87830]">
                          {roleLabel(msg.sender_role)}
                        </span>
                        <ClientFormattedDate
                          iso={msg.created_at}
                          pattern="MMM d, h:mm a"
                          fallback=""
                        />
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={clientEndRef} />
            </div>
            <form onSubmit={sendPortalMessage} className="border-t border-gray-100 p-3 dark:border-[#2E2E2E]">
              {portalTypingUsers.length > 0 ? (
                <div className="mb-2 flex items-end gap-2 px-1">
                  <div className="flex items-center gap-1 rounded-lg rounded-bl-sm bg-gray-100 px-4 py-3 dark:bg-[#242424]">
                    <span
                      className="h-2 w-2 rounded-full bg-gray-400 dark:bg-[#A87830]"
                      style={{ animation: "typingDot 1.4s infinite", animationDelay: "0ms" }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-gray-400 dark:bg-[#A87830]"
                      style={{ animation: "typingDot 1.4s infinite", animationDelay: "200ms" }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-gray-400 dark:bg-[#A87830]"
                      style={{ animation: "typingDot 1.4s infinite", animationDelay: "400ms" }}
                    />
                  </div>
                  <span className="mb-1 text-xs text-gray-400 dark:text-slate-500">
                    {portalTypingUsers.join(", ")} typing...
                  </span>
                </div>
              ) : null}
              <div
                className="rounded-xl border border-gray-200 bg-white transition-colors focus-within:border-[#A87830] focus-within:ring-1 focus-within:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#121212] dark:focus-within:border-[#A87830] dark:focus-within:ring-[#A87830]"
                data-emoji-popover
              >
                <textarea
                  ref={portalTextareaRef}
                  value={portalInput}
                  onChange={(e) => {
                    setPortalInput(e.target.value);
                    throttlePortalTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendPortalMessage(e as unknown as React.FormEvent);
                    }
                  }}
                  disabled={!selectedClientId || busy}
                  placeholder="Type a message... (Enter to send)"
                  aria-label="Type a message to client"
                  rows={1}
                  className="max-h-32 min-h-[44px] w-full resize-none rounded-t-xl bg-transparent px-4 pb-2 pt-3 text-sm text-slate-900 focus:outline-none dark:text-[#E8EAEE]"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                />
                <div className="flex items-center justify-between border-t border-gray-100 px-3 pb-2 dark:border-[#2E2E2E]">
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <button
                        type="button"
                        title="Add emoji"
                        aria-label="Add emoji"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPortalEmoji((v) => !v);
                          setShowTeamEmoji(false);
                          setShowDeptEmoji(false);
                        }}
                        className="rounded-lg p-1.5 text-base leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-[#242424] dark:hover:text-slate-300"
                      >
                        😊
                      </button>
                      {showPortalEmoji ? (
                        <div className="absolute bottom-9 left-0 z-50 grid w-48 grid-cols-6 gap-0.5 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
                          {COMMON_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              aria-label={`Add ${emoji} emoji`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setPortalInput((prev) => prev + emoji);
                                setShowPortalEmoji(false);
                              }}
                              className="rounded-lg p-1 text-lg leading-none transition-colors hover:bg-gray-100 dark:hover:bg-[#242424]"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <label
                      title="Attach file"
                      aria-label="Attach file"
                      className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-[#242424] dark:hover:text-slate-300"
                    >
                      <input
                        type="file"
                        className="hidden"
                        accept="*/*"
                        disabled={!selectedClientId || busy}
                        onChange={async (ev) => {
                          const f = ev.target.files?.[0];
                          ev.target.value = "";
                          if (!f) return;
                          setUploadingPortal(true);
                          try {
                            const marker = await uploadChatFile(f);
                            if (marker)
                              setPortalInput((prev) => (prev ? `${prev}\n` : "") + marker);
                          } finally {
                            setUploadingPortal(false);
                          }
                        }}
                      />
                      <PaperclipIcon />
                    </label>
                  </div>
                  <button
                    type="button"
                    title="Send message"
                    aria-label="Send message"
                    onClick={() => void sendPortalMessage()}
                    disabled={
                      !selectedClientId ||
                      busy ||
                      (!portalInput.trim() && !uploadingPortal)
                    }
                    className="flex items-center justify-center rounded-lg bg-[#A87830] p-2 text-[#161616] transition-colors hover:bg-[#8C6428] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy || uploadingPortal ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendPlaneIcon />
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
