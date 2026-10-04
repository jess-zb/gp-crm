"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { ModalOverlay } from "@/app/components/ModalOverlay";
import { createClient } from "@/lib/supabase/client";
import { buildSearchQuery } from "@/lib/clients/client-search";
import { STAGE_LABELS } from "@/lib/constants/stages";
import {
  canAccessAttorneyQueue,
  canAccessReports,
  canAccessTeamPage,
  isDevOrAdmin,
} from "@/lib/roles";

const OPEN_EVENT = "gp-open-command-menu";

export function openCommandMenu() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CommandMenuTrigger({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openCommandMenu()}
      title={`Search clients or jump to a page (${COMMAND_SHORTCUT_LABEL})`}
      aria-label={`Search clients or jump to a page, ${COMMAND_SHORTCUT_LABEL}`}
      className={`pointer-events-auto flex h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-slate-600 shadow-sm transition-colors hover:border-[#A87830] hover:text-[#A87830] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:border-[#2E2E2E] dark:bg-[#1C1C1C] dark:text-slate-300 dark:hover:border-[#A87830] dark:hover:text-[#A87830] ${className}`}
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <kbd className="font-sans text-[10px] font-medium tracking-wide">{COMMAND_SHORTCUT_LABEL}</kbd>
    </button>
  );
}

export const COMMAND_SHORTCUT_LABEL = "⌘K / Ctrl+K";

type ClientHit = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  stage: string | null;
  is_active: boolean | null;
  phone_mobile: string | null;
  email: string | null;
};

type Jump = { kind: "page"; href: string; label: string } | { kind: "client"; client: ClientHit };

function pageJumps(role: string): { href: string; label: string }[] {
  const pages = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/pipeline", label: "Pipeline" },
    { href: "/reminders", label: "Appointments" },
    { href: "/knowledge-base", label: "Knowledge Base" },
  ];
  if (canAccessTeamPage(role)) pages.push({ href: "/team", label: "Team" });
  if (isDevOrAdmin(role)) {
    pages.push({ href: "/esign-documents", label: "E-Sign Documents" });
  }
  if (canAccessAttorneyQueue(role)) {
    pages.push({ href: "/admin/attorney-queue", label: "Attorney Queue" });
  }
  if (canAccessReports(role)) pages.push({ href: "/reports", label: "Reports" });
  pages.push({ href: "/settings", label: "Settings" });
  return pages;
}

function clientLabel(client: ClientHit): string {
  const name = [client.first_name, client.last_name].filter(Boolean).join(" ") || "Unnamed client";
  const nick = client.nickname?.trim();
  return nick ? `${name} “${nick}”` : name;
}

function clientMeta(client: ClientHit): string {
  const stage = STAGE_LABELS[client.stage ?? ""] || "No stage";
  const scope = client.is_active === true ? "Active" : "Archived";
  return `${stage} · ${scope}`;
}

/** Prefer a direct name or email hit. Active is only a tie-break, so an archived person still shows. */
function clientScore(client: ClientHit, query: string): number {
  const q = query.trim().toLowerCase();
  const full = [client.first_name, client.last_name].filter(Boolean).join(" ").toLowerCase();
  const fields = [full, client.first_name, client.last_name, client.nickname, client.email]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  let score = 10;
  if (fields.some((value) => value === q)) score = 100;
  else if (fields.some((value) => value.startsWith(q))) score = 40;
  if (client.is_active === true) score += 1;
  return score;
}

export function CommandMenu({ role }: { role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [settledQuery, setSettledQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pages = useMemo(() => pageJumps(role), [role]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setClients([]);
      setSettledQuery("");
      setActive(0);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setClients([]);
      setLoading(false);
      setSettledQuery("");
      return;
    }
    const orFragment = buildSearchQuery(q);
    if (!orFragment) {
      setClients([]);
      setSettledQuery(q);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const supabase = createClient();
          const { data } = await supabase
            .from("clients")
            .select("id, first_name, last_name, nickname, stage, is_active, phone_mobile, email")
            .or(orFragment)
            .limit(24);
          if (!cancelled) {
            const ranked = [...(data ?? [])].sort(
              (a, b) => clientScore(b, q) - clientScore(a, q)
            );
            setClients(ranked.slice(0, 8));
            setSettledQuery(q);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const jumps = useMemo((): Jump[] => {
    const q = query.trim().toLowerCase();
    const pageRows: Jump[] = pages
      .filter((page) => !q || page.label.toLowerCase().includes(q))
      .map((page) => ({ kind: "page", href: page.href, label: page.label }));
    const clientRows: Jump[] = clients.map((client) => ({ kind: "client", client }));
    return [...pageRows, ...clientRows];
  }, [pages, clients, query]);

  useEffect(() => {
    setActive(0);
  }, [query, clients.length]);

  const go = useCallback(
    (jump: Jump) => {
      close();
      if (jump.kind === "page") {
        router.push(jump.href);
        return;
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem("clientListUrl", window.location.href);
      }
      router.push(`/clients/${jump.client.id}`);
    },
    [close, router]
  );

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (jumps.length === 0 ? 0 : (index + 1) % jumps.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) =>
        jumps.length === 0 ? 0 : (index - 1 + jumps.length) % jumps.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const jump = jumps[active];
      if (jump) go(jump);
    }
  }

  if (!open) return null;

  const pageRows = jumps.filter((jump) => jump.kind === "page");
  const clientRows = jumps.filter((jump) => jump.kind === "client");
  let rowIndex = -1;

  return (
    <ModalOverlay labelledBy="command-menu-title" className="z-[300] bg-black/50" onBackdropClick={close}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <h2 id="command-menu-title" className="sr-only">
          Search and jump
        </h2>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3 dark:border-[#2E2E2E]">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search clients, or jump to a page…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
            aria-label="Search clients, or jump to a page"
            aria-autocomplete="list"
            aria-controls="command-menu-results"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden />
          ) : (
            <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline dark:border-[#2E2E2E]">
              esc
            </kbd>
          )}
        </div>
        <div id="command-menu-results" className="max-h-80 overflow-y-auto py-2" role="listbox">
          {pageRows.length > 0 ? (
            <p className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Go to
            </p>
          ) : null}
          {pageRows.map((jump) => {
            rowIndex += 1;
            const index = rowIndex;
            const selected = index === active;
            if (jump.kind !== "page") return null;
            return (
              <button
                key={jump.href}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full items-center px-4 py-2 text-left text-sm ${
                  selected
                    ? "bg-[#F4E8D4] text-slate-900 dark:bg-[#2A2418] dark:text-white"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#242424]"
                }`}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(jump)}
              >
                {jump.label}
              </button>
            );
          })}
          {clientRows.length > 0 ? (
            <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Clients
            </p>
          ) : null}
          {clientRows.map((jump) => {
            rowIndex += 1;
            const index = rowIndex;
            const selected = index === active;
            if (jump.kind !== "client") return null;
            const client = jump.client;
            return (
              <button
                key={client.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${
                  selected
                    ? "bg-[#F4E8D4] text-slate-900 dark:bg-[#2A2418] dark:text-white"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#242424]"
                }`}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(jump)}
              >
                <span className="min-w-0 truncate font-medium">{clientLabel(client)}</span>
                <span className="shrink-0 text-xs text-slate-400">{clientMeta(client)}</span>
              </button>
            );
          })}
          {query.trim() && settledQuery === query.trim() && !loading && jumps.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No matches</p>
          ) : null}
        </div>
      </div>
    </ModalOverlay>
  );
}
