"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { toUserFacingError } from "@/lib/user-facing-error";
import { documentTypeLabel } from "@/lib/clients/document-upload";
import {
  getCarrierColor,
  getCarrierLabel,
  getTrackingUrl,
} from "@/lib/utils/tracking";

import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";
import { PortalShell } from "@/app/components/PortalShell";
import {
  ALL_STAGE_ORDER,
  STAGE_LABELS,
  isPipelineStageHidden,
} from "@/lib/constants/stages";

const STAGE_KEYS = ALL_STAGE_ORDER.filter((k) => !isPipelineStageHidden(k));

const PROGRESS_LABELS = STAGE_KEYS.map((k) => STAGE_LABELS[k] ?? k);

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  stage: string;
  delivery_method: string | null;
  fedex_tracking_number: string | null;
  postlogic_status: string | null;
};

type DocRow = {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  document_type: string | null;
  created_at: string | null;
  is_collection_letter: boolean | null;
};

type MsgRow = {
  id: string;
  sender_name: string | null;
  message: string;
  created_at: string | null;
  sender_role: string | null;
};

function stageIndex(stage: string): number {
  const keys = STAGE_KEYS as readonly string[];
  const i = keys.indexOf(stage);
  return i >= 0 ? i : 0;
}

function atOrAfterWelcomePacket(stage: string): boolean {
  const keys = STAGE_KEYS as readonly string[];
  return stageIndex(stage) >= keys.indexOf("welcome_packet");
}

function postlogicPlainEnglish(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const s = raw.toLowerCase();
  if (
    s.includes("processing") ||
    s.includes("pending") ||
    s.includes("label") ||
    s.includes("prepared")
  ) {
    return "Your packet is being prepared";
  }
  if (s.includes("delivered")) {
    return "Your packet has been delivered";
  }
  if (
    s.includes("transit") ||
    s.includes(" on the way") ||
    s.includes("on the way") ||
    s.includes("in transit") ||
    s.includes("picked up") ||
    s.includes("out for delivery")
  ) {
    return "Your packet is on the way";
  }
  return "We're updating your welcome packet.";
}


export default function PortalPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [notClient, setNotClient] = useState(false);
  const [noAccess, setNoAccess] = useState(false);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [sending, setSending] = useState(false);

  const loadPortalData = useCallback(async (authEmail: string | null | undefined) => {
    const supabase = createClient();
    const email = authEmail?.trim().toLowerCase();
    if (!email) {
      setNoAccess(true);
      setClient(null);
      setDocuments([]);
      setMessages([]);
      return;
    }

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select(
        "id, first_name, last_name, stage, delivery_method, fedex_tracking_number, postlogic_status"
      )
      .eq("email", email)
      .maybeSingle();

    if (clientErr) {
      console.error(clientErr);
      setNoAccess(true);
      setClient(null);
      setDocuments([]);
      setMessages([]);
      return;
    }

    if (!clientRow) {
      setNoAccess(true);
      setClient(null);
      setDocuments([]);
      setMessages([]);
      return;
    }

    const row = clientRow as ClientRow;
    setNoAccess(false);
    setClient(row);

    const cid = row.id as string;

    const { data: docs } = await supabase
      .from("documents")
      .select(
        "id, file_name, storage_path, mime_type, document_type, created_at, is_collection_letter"
      )
      .eq("client_id", cid)
      .order("created_at", { ascending: false });

    const filtered =
      (docs ?? []).filter(
        (d) =>
          d.document_type !== "collection_letter" &&
          d.is_collection_letter !== true
      ) ?? [];

    setDocuments(filtered as DocRow[]);

    const { data: msgs } = await supabase
      .from("portal_messages")
      .select("id, sender_name, message, created_at, sender_role")
      .eq("client_id", cid)
      .order("created_at", { ascending: false });

    setMessages([...(msgs ?? [])].reverse() as MsgRow[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setLoading(false);
        router.replace("/portal/login");
        return;
      }


      setUserId(user.id);

      const { data: prof } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!prof || prof.role !== "client") {
        setNotClient(true);
        setLoading(false);
        router.replace("/dashboard");
        return;
      }

      setProfileName(prof.full_name?.trim() || null);
      await loadPortalData(user.email);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPortalData, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/portal/login");
    router.refresh();
  }

  async function downloadDoc(row: DocRow) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(row.storage_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error(toUserFacingError(error?.message ?? "Could not download file."));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function sendMessage() {
    const text = messageDraft.trim();
    if (!text || !client || !userId) return;
    setSending(true);
    const supabase = createClient();
    const senderDisplay =
      profileName?.trim() ||
      `${client.first_name} ${client.last_name}`.trim() ||
      "Client";
    const { error } = await supabase.from("portal_messages").insert({
      client_id: client.id,
      sender_id: userId,
      sender_name: senderDisplay,
      sender_role: "client",
      message: text,
    });
    setSending(false);
    if (error) {
      toast.error(toUserFacingError(error.message));
      return;
    }
    setMessageDraft("");
    toast.success("Message sent");
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    await loadPortalData(u?.email);
  }

  const progressStyles = useMemo(() => {
    if (!client) return [];
    const idx = stageIndex(client.stage);
    const isClosed = client.stage === "closed";
    return PROGRESS_LABELS.map((_, i) => {
      if (isClosed) {
        return { bar: "bg-[#8DE3B5]", label: "text-slate-700 dark:text-slate-200" };
      }
      if (i < idx) {
        return { bar: "bg-[#8DE3B5]", label: "text-slate-700 dark:text-slate-200" };
      }
      if (i === idx) {
        return { bar: "bg-[#8DE3B5]", label: "text-slate-800 dark:text-slate-100 font-semibold" };
      }
      return { bar: "bg-slate-200 dark:bg-slate-600", label: "text-slate-400 dark:text-slate-500" };
    });
  }, [client]);

  const welcomeSection = useMemo(() => {
    if (!client || !atOrAfterWelcomePacket(client.stage)) return null;
    const dm = client.delivery_method;

    if (dm === "fedex") {
      const trk = client.fedex_tracking_number?.trim();
      const statusMsg = postlogicPlainEnglish(client.postlogic_status);
      return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Welcome packet
          </h2>
          {trk ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                Tracking number:
              </span>
              <a
                href={getTrackingUrl(trk)}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-mono text-[#8DE3B5] underline"
              >
                {trk}
              </a>
              <span
                className={`rounded border px-1.5 py-0.5 text-xs font-medium ${getCarrierColor(trk)}`}
              >
                {getCarrierLabel(trk)}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Tracking number will appear here when available.
            </p>
          )}
          {statusMsg ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {statusMsg}
            </p>
          ) : null}
        </section>
      );
    }
    if (dm === "docusign") {
      return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Welcome packet
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            Your team will share delivery and signing details by email or phone.
          </p>
        </section>
      );
    }
    return null;
  }, [client]);

  if (notClient) {
    return null;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F6F8] px-4 py-10 dark:bg-[#071929]">
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          Loading…
        </p>
      </main>
    );
  }

  if (noAccess || !client) {
    const shellName = profileName?.trim() || "Client";
    return (
      <PortalShell
        displayName={shellName}
        onSignOut={() => void signOut()}
      >
        <main className="min-h-screen bg-[#F5F6F8] px-4 py-8 dark:bg-[#071929]">
          <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            We couldn&apos;t find an active client profile for this account email. Please contact
            your case manager.
          </div>
          <p className="mx-auto mt-6 max-w-lg text-center text-sm text-slate-500">
            <Link href="/portal/login" className="text-[#8DE3B5] underline">
              Portal sign in
            </Link>
          </p>
        </main>
      </PortalShell>
    );
  }

  const firstName = client.first_name?.trim() || "there";
  const shellDisplayName =
    profileName?.trim() ||
    `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
    "Client";

  return (
    <PortalShell
      displayName={shellDisplayName}
      onSignOut={() => void signOut()}
    >
      <main className="min-h-screen bg-[#F5F6F8] pb-12 dark:bg-[#071929]">
        <div className="mx-auto max-w-lg space-y-6 px-4 pt-6">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="text-center text-xl font-semibold text-slate-900 dark:text-white sm:text-left">
              Welcome, {firstName}
            </h1>
            <Link
              href="/portal/help"
              className="shrink-0 text-sm font-semibold text-[#8DE3B5] underline-offset-4 hover:underline"
            >
              Help
            </Link>
          </div>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
            Your progress
          </h2>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {PROGRESS_LABELS.map((label, i) => (
              <div key={label} className="flex min-w-[72px] max-w-[100px] flex-1 flex-col items-center">
                <div
                  className={`h-2.5 w-full rounded-full ${progressStyles[i]?.bar ?? "bg-slate-200"}`}
                  title={label}
                />
                <p
                  className={`mt-2 text-center text-[10px] leading-tight sm:text-xs ${progressStyles[i]?.label ?? ""}`}
                >
                  {i + 1}. {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {welcomeSection}

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">
            Documents
          </h2>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No documents are available yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-[#1a3550]">
              {documents.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {d.file_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {documentTypeLabel(d.document_type)}
                      {d.created_at ? (
                        <>
                          {" "}
                          ·{" "}
                          <ClientFormattedDate
                            iso={d.created_at}
                            pattern="MMM d, h:mm a"
                            fallback=""
                          />
                        </>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadDoc(d)}
                    className="shrink-0 rounded-lg border border-[#8DE3B5] bg-[#8DE3B5]/10 px-3 py-1.5 text-sm font-semibold text-[#8DE3B5] dark:bg-[#8DE3B5]/20"
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1a3550] dark:bg-[#0d2035]">
          <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">
            Messages
          </h2>
          <div className="mb-3 max-h-72 space-y-3 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-[#1a3550] dark:bg-[#071929]/50">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                No messages yet. Say hello to your team below.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.sender_role === "client"
                      ? "ml-4 bg-[#8DE3B5]/15 dark:bg-[#8DE3B5]/25"
                      : "mr-4 bg-white dark:bg-[#0d2035]"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {m.sender_name?.trim() || "Team"}{" "}
                    <span className="font-normal text-slate-400">
                      {m.created_at ? (
                        <ClientFormattedDate
                          iso={m.created_at}
                          pattern="MMM d, h:mm a"
                          fallback=""
                        />
                      ) : (
                        ""
                      )}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                    {m.message}
                  </p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={messageDraft}
              onChange={(e) => setMessageDraft(e.target.value)}
              rows={3}
              placeholder="Type a message to your team…"
              className="min-h-[80px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-[#1a3550] dark:bg-[#071929] dark:text-[#E8EAEE]"
            />
            <button
              type="button"
              disabled={sending || !messageDraft.trim()}
              onClick={() => void sendMessage()}
              className="h-fit shrink-0 rounded-lg bg-[#8DE3B5] px-4 py-2.5 text-sm font-bold text-[#0A2540] disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </section>
        </div>
      </main>
    </PortalShell>
  );
}
