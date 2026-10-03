"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { formatShortMonthDayTime } from "@/lib/utils/date";
import type { AttorneyClientOption } from "./page";

type MsgRow = {
  id: string;
  sender_name: string | null;
  message: string;
  created_at: string | null;
  sender_role: string | null;
};

function clientLabel(c: AttorneyClientOption) {
  const n = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  return n || "Client";
}

export function AttorneyCommunicationsClient({
  clients,
  userId,
  senderName,
}: {
  clients: AttorneyClientOption[];
  userId: string;
  senderName: string;
}) {
  const toast = useToast();
  const endRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(clients[0]?.id ?? null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? null,
    [clients, selectedId]
  );

  const loadMessages = useCallback(async (clientId: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("portal_messages")
      .select("id, sender_name, message, created_at, sender_role")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      setMessages([]);
      return;
    }
    setMessages([...(data ?? [])].reverse() as MsgRow[]);
  }, [toast]);

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !selectedId) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from("portal_messages").insert({
      client_id: selectedId,
      sender_id: userId,
      sender_name: senderName,
      sender_role: "attorney",
      message: text,
    });
    setSending(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    setDraft("");
    toast.success("Message sent");
    await loadMessages(selectedId);
  }

  if (clients.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No assigned cases yet — messages will appear when you have active matters.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flex min-h-[480px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C] md:flex-row">
      <div className="max-h-[200px] shrink-0 overflow-y-auto border-b border-slate-200 pb-2 dark:border-[#2E2E2E] md:max-h-none md:w-56 md:border-b-0 md:border-r md:pb-0">
        <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-[#2E2E2E] dark:text-slate-400">
          Clients
        </p>
        <ul className="p-1">
          {clients.map((c) => {
            const active = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    active
                      ? "bg-[#A87830]/20 text-[#121212] dark:bg-[#A87830]/25 dark:text-[#E8EAEE]"
                      : "text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#242424]"
                  }`}
                >
                  {clientLabel(c)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-[#2E2E2E]">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {selected ? clientLabel(selected) : "Select a client"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Portal thread</p>
        </div>

        <div className="min-h-[280px] flex-1 space-y-3 overflow-y-auto bg-slate-50/80 p-4 dark:bg-[#121212]/50">
          {loading ? (
            <p className="text-center text-sm text-slate-500">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              No messages yet.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_role === "attorney";
              return (
                <div
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    mine
                      ? "ml-8 bg-[#A87830]/15 dark:bg-[#A87830]/25"
                      : "mr-8 bg-white dark:bg-[#1C1C1C]"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {m.sender_role === "dev" ? "Team" : (m.sender_name ?? "Sender").trim() || "Sender"}{" "}
                    <span className="font-normal text-slate-400">
                      {m.created_at ? formatShortMonthDayTime(m.created_at) : ""}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                    {m.message}
                  </p>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-200 p-3 dark:border-[#2E2E2E]">
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Type a reply…"
              disabled={!selectedId}
              className="min-h-[80px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-[#E8EAEE]"
            />
            <button
              type="button"
              disabled={sending || !draft.trim() || !selectedId}
              onClick={() => void sendMessage()}
              className="h-fit shrink-0 rounded-lg bg-[#A87830] px-4 py-2.5 text-sm font-bold text-[#161616] disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
