import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { StagePill } from "@/app/components/StagePill";
import { formatDateTimeOrDash } from "@/lib/utils/date";
import { isPoaDocumentType } from "@/lib/clients/poa-upload-advance";
import { midNameFromEmbed } from "@/lib/mids/queries";
import { isHiddenProfile } from "@/lib/constants/hidden-accounts";
import { AttorneyCaseStageActions } from "../AttorneyCaseStageActions";
import {
  AttorneyCaseDocuments,
  type AttorneyCaseDocItem,
} from "../AttorneyCaseDocuments";
import {
  AttorneyCaseNotes,
  type AttorneyCaseNoteItem,
} from "../AttorneyCaseNotes";

type DocRow = {
  id: string;
  file_name: string;
  document_type: string | null;
  mime_type: string | null;
  created_at: string | null;
  is_collection_letter: boolean | null;
};

/** Same filter as CRM client profile — hide legacy stage/assignment/appointment system notes. */
function isLegacySystemNote(row: { type?: unknown; body?: unknown }): boolean {
  if ((row.type as string) !== "note") return false;
  const body = String(row.body ?? "");
  return (
    body.startsWith("Stage changed to:") ||
    body.startsWith("Appointment scheduled:") ||
    / assigned as /.test(body) ||
    /self-assigned as /.test(body) ||
    /assigned themselves as /.test(body)
  );
}

function docRowTypeLabel(d: DocRow): string {
  if (isPoaDocumentType((d.document_type ?? "").trim())) return "POA";
  if (d.document_type === "collection_letter" || d.is_collection_letter === true) {
    return "Collection letter";
  }
  const raw = (d.document_type ?? "").trim();
  if (!raw || raw === "general") return "Upload";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toDocItem(d: DocRow): AttorneyCaseDocItem {
  return {
    id: d.id,
    fileName: d.file_name,
    createdAt: d.created_at,
    mimeType: d.mime_type,
    typeLabel: docRowTypeLabel(d),
  };
}

export default async function AttorneyCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id: clientId } = await Promise.resolve(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error: profErr } = await getProfileForUser(supabase, user);
  if (profErr || !profile) {
    if (profErr) console.error("[AttorneyCaseDetailPage] profile error:", profErr);
    redirect("/login");
  }

  if (
    profile.role !== "attorney" &&
    profile.role !== "admin" &&
    profile.role !== "dev"
  ) {
    redirect("/dashboard");
  }

  const isPrivileged = profile.role === "admin" || profile.role === "dev";
  let clientQuery = supabase
    .from("clients")
    .select(
      "id, first_name, last_name, email, phone, street_address, city, state, zip_code, stage, case_sent_to_attorney_at, created_at, attorney_id, attorney_portal_assigned_at, mids(name)"
    )
    .eq("id", clientId)
    .in("stage", ["case_sent_to_attorneys", "closed"])
    .not("attorney_portal_assigned_at", "is", null);
  if (!isPrivileged) {
    clientQuery = clientQuery.eq("attorney_id", user.id);
  }
  const { data: client, error: clientErr } = await clientQuery.maybeSingle();

  if (clientErr || !client) {
    if (clientErr) console.error("[AttorneyCaseDetailPage] client fetch error:", clientErr.message);
    notFound();
  }

  const displayName =
    `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Client";
  const stageKey = client.stage as string;

  const canActOnCase =
    (profile.role === "attorney" && (client.attorney_id as string | null) === user.id) ||
    profile.role === "dev" ||
    profile.role === "admin";
  const performerName = profile.full_name?.trim() || user.email || "User";

  const { data: docsRaw, error: docsErr } = await supabase
    .from("documents")
    .select(
      "id, file_name, document_type, mime_type, created_at, is_collection_letter"
    )
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (docsErr) {
    console.error("[AttorneyCaseDetailPage] documents fetch error:", docsErr.message);
  }

  const docItems = ((docsRaw ?? []) as DocRow[]).map(toDocItem);

  const { data: notesRaw, error: notesErr } = await supabase
    .from("communications")
    .select("id, type, body, sent_at, recorded_by, is_pinned")
    .eq("client_id", clientId)
    .eq("type", "note")
    .order("sent_at", { ascending: false });

  if (notesErr) {
    console.error("[AttorneyCaseDetailPage] notes fetch error:", notesErr.message);
  }

  const noteRecorderIds = Array.from(
    new Set(
      (notesRaw ?? [])
        .map((n) => n.recorded_by as string | null)
        .filter((id): id is string => Boolean(id))
    )
  );
  const nameById: Record<string, string> = {};
  if (noteRecorderIds.length > 0) {
    const { data: profilesRaw, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("id", noteRecorderIds);
    if (profilesErr) {
      console.error(
        "[AttorneyCaseDetailPage] note author fetch error:",
        profilesErr.message
      );
    } else {
      for (const p of profilesRaw ?? []) {
        if (isHiddenProfile({ email: p.email as string | null, role: p.role as string | null }, profile.role)) {
          continue;
        }
        nameById[p.id as string] = (p.full_name as string | null)?.trim() || "";
      }
    }
  }

  const noteItems: AttorneyCaseNoteItem[] = (notesRaw ?? [])
    .filter((n) => !isLegacySystemNote(n))
    .map((n) => ({
      id: n.id as string,
      body: String(n.body ?? "").trim() || "(Empty note)",
      sentAt: (n.sent_at as string | null) ?? null,
      authorName: n.recorded_by
        ? nameById[n.recorded_by as string]?.trim() || "Staff"
        : "Staff",
      isPinned: (n.is_pinned as boolean | null) ?? false,
    }));

  return (
    <main className="mx-auto min-w-0 max-w-[1200px] overflow-x-hidden px-4 py-6 sm:py-8">
      <Link
        href="/attorney/cases"
        className="text-sm font-medium text-[#161616] hover:underline dark:text-[#A87830]"
      >
        ← Back to Cases
      </Link>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="crm-page-title text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {displayName}
              </h1>
              <StagePill stage={stageKey} />
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Assigned to portal{" "}
              {formatDateTimeOrDash(client.attorney_portal_assigned_at as string | null)}
            </p>
          </div>
          {(profile.role === "attorney" || profile.role === "dev" || profile.role === "admin") && (
            <AttorneyCaseStageActions
              clientId={clientId}
              stage={stageKey}
              canAct={canActOnCase}
              userId={user.id}
              performerName={performerName}
            />
          )}
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-8">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Client Info
            </h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Name</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{displayName}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">MID</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {midNameFromEmbed((client as { mids?: unknown }).mids) ?? "No MID"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                <dd className="break-all font-medium text-slate-900 dark:text-slate-100">
                  {(client.email as string | null) ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Phone</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {(client.phone as string | null) ?? "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500 dark:text-slate-400">Address</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {[
                    client.street_address,
                    [client.city, client.state].filter(Boolean).join(", "),
                    client.zip_code,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
              </div>
            </dl>
          </section>

          <AttorneyCaseDocuments docs={docItems} />
          <AttorneyCaseNotes notes={noteItems} />
        </div>

        <aside className="w-full shrink-0 space-y-6 lg:w-80">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Account info
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Date added</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                  {formatDateTimeOrDash(client.created_at as string | null)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Date sent to attorneys</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                  {formatDateTimeOrDash(client.case_sent_to_attorney_at as string | null)}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
