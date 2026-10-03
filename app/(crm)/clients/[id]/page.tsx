import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import {
  canAccessPriorityBoard,
  canDeleteDocuments,
  canEditAttorneyAssignment,
  canReassignClient,
  canViewAssignedAttorneyField,
} from "@/lib/roles";
import { isPoaDocumentTypeForCs } from "@/lib/clients/cs-checklist";
import { hasCcAuthorizationOnRecord } from "@/lib/workflow/stage-blockers";
import {
  fetchCsChecklistForClient,
  shouldShowCsChecklistCard,
} from "@/lib/clients/cs-checklist-query";
import { CsChecklistCard } from "./CsChecklistCard";
import { AccountTabForm, type AccountTabClient } from "./AccountTabForm";
import { BillingTabContent } from "./BillingTabContent";
import { ClientRightSidebar, type SidebarCommNoteRow } from "./ClientRightSidebar";
import { listUpcomingEmailsForClient } from "@/lib/email/upcoming-for-client";
import { ClientSettingsTab, type ClientSettingsTabClient } from "./ClientSettingsTab";
import { refundPrefillFromCards } from "@/lib/refunds/prefill";
import { ClientStageHeader } from "./ClientStageHeader";
import { ClientViewLogger } from "./ClientViewLogger";
import { CommunicationsTab } from "./CommunicationsTab";
import { DocumentsTab, type DocumentListItem } from "./DocumentsTab";
import { EmailActivityTabClient } from "./EmailActivityTabClient";
import { canUseEsignStaffUi, isEsignFeatureEnabled } from "@/lib/esign/config";
import { toUserFacingError } from "@/lib/user-facing-error";
import { HIDDEN_FROM_NON_DEV_EMAILS, isHiddenProfile } from "@/lib/constants/hidden-accounts";
import { midNameFromEmbed } from "@/lib/mids/queries";
import { loadHiddenActors, redactActorName } from "@/lib/auth/hidden-actor";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";
import { formatDateTime } from "@/lib/utils/date";
import { ClientBackButton } from "./ClientBackButton";
import { EsignDripSection } from "./EsignDripSection";
import { canShowEsignActions } from "@/lib/esign/types";

const MAIN_TABS_ALL = [
  { id: "account", label: "Account" },
  { id: "billing", label: "Cards" },
  { id: "documents", label: "Documents" },
  { id: "communications", label: "Activity" },
  { id: "campaigns", label: "Drips" },
  { id: "portal", label: "Portal Messages" },
  { id: "settings", label: "Settings" },
] as const;

// Tabs that resolve to a real render block (portal has no block here).
// "billing" stays valid so ?tab=billing still works if accessed directly, but it
// is hidden from the tab bar (see VISIBLE_TABS) per F004.
const MAIN_TABS = MAIN_TABS_ALL.filter((t) => t.id !== "portal");

// Tabs actually rendered in the tab bar. "billing" (Cards) is hidden from all
// roles; the underlying feature, data query, and client_cards table remain intact.
const VISIBLE_TABS = MAIN_TABS.filter((t) => t.id !== "billing");

type MainTab = (typeof MAIN_TABS_ALL)[number]["id"];

type DocRow = {
  id: string;
  file_name: string;
  mime_type: string | null;
  document_type: string | null;
  created_at: string | null;
  uploaded_by: string | null;
  storage_path: string;
  file_size_bytes: number | null;
  notes: string | null;
  is_collection_letter?: boolean | null;
  attorney_notified_at?: string | null;
  attorney_notify_error?: string | null;
};

function tabHref(clientId: string, tab: MainTab) {
  return tab === "account" ? `/clients/${clientId}` : `/clients/${clientId}?tab=${tab}`;
}

function tabClass(active: boolean) {
  if (active) {
    return "inline-flex min-h-11 shrink-0 items-center border-b-2 border-[#A87830] px-4 py-3 text-sm font-semibold text-slate-900 transition-colors duration-200 ease-out dark:text-white";
  }
  return "inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-500 transition-colors duration-200 ease-out hover:text-slate-900 dark:text-slate-400 dark:hover:text-white";
}

function formatClientDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateTime(d);
}

const CLIENT_SELECT = [
  "id",
  "first_name",
  "middle_initial",
  "last_name",
  "nickname",
  "verbal_password",
  "spouse_first_name",
  "spouse_last_name",
  "spouse_name",
  "spouse_nickname",
  "email",
  "phone",
  "phone_mobile",
  "phone_work",
  "phone_home",
  "street_address",
  "city",
  "state",
  "zip_code",
  "stage",
  "assigned_to",
  "assigned_services_id",
  "dnc_reason",
  "is_active",
  "created_at",
  "updated_at",
  "poa_signed_at",
  "collection_letter_received_at",
  "attorney_id",
  "cc_charged_at",
  "reviewed_at",
  "reviewed_by_name",
  "mid_id",
  // Fallback MID for the refund request prefill when no card carries a merchant.
].join(", ");

type ClientPageProps = {
  /** Next.js 15 may pass Promises for dynamic segment props. */
  params: Promise<{ id: string }> | { id: string };
  searchParams: Promise<{ tab?: string; upload?: string }> | { tab?: string; upload?: string };
};

export default async function ClientProfilePage({
  params,
  searchParams,
}: ClientPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const clientId =
    typeof resolvedParams === "object" &&
    resolvedParams !== null &&
    "id" in resolvedParams &&
    typeof (resolvedParams as { id: unknown }).id === "string"
      ? (resolvedParams as { id: string }).id.trim()
      : "";
  const sp = await Promise.resolve(searchParams);
  if (!clientId) {
    notFound();
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error: pe } = await getProfileForUser(supabase, user);
  if (pe || !profile) redirect("/login");
  if (profile.role === "client") redirect("/portal");
  if (profile.role === "attorney") redirect("/attorney/cases");

  const tabRaw = sp.tab ?? "account";
  const tabNormalized =
    tabRaw === "email"
      ? "campaigns"
      : tabRaw === "letters" || tabRaw === "packets"
        ? "documents"
        : tabRaw;
  const tab: MainTab = MAIN_TABS.some((t) => t.id === tabNormalized)
    ? (tabNormalized as MainTab)
    : "account";

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select(
      `${CLIENT_SELECT}, mids(name), attorney:profiles!attorney_id(full_name, email), assigned_user:profiles!assigned_to(full_name, role, email), services_manager:profiles!assigned_services_id(full_name, role, email)`
    )
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr) {
    console.error("[ClientProfilePage] clients select failed", {
      clientId,
      message: clientErr.message,
      code: clientErr.code,
      details: clientErr.details,
      hint: clientErr.hint,
    });
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-lg font-semibold text-red-600 dark:text-red-400">
          Could not load client
        </h1>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          {toUserFacingError(clientErr.message)}
        </p>
        <Link
          href="/clients"
          className="mt-8 inline-block text-sm font-semibold text-[#A87830] hover:underline dark:text-[#A87830]"
        >
          ← Back to clients
        </Link>
      </main>
    );
  }

  try {
  if (!client) {
    notFound();
  }

  type ClientRow = Record<string, unknown> & { id: string };
  const c = client as unknown as ClientRow;

  const [
    { data: viewerDept },
    { data: accountsProfileRow },
    { data: servicesProfileRow },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_accounts, is_services, full_name")
      .eq("id", user.id)
      .maybeSingle(),
    c.assigned_to
      ? supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("id", String(c.assigned_to))
          .maybeSingle()
      : Promise.resolve({ data: null }),
    c.assigned_services_id
      ? supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("id", String(c.assigned_services_id))
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const viewerDeptFlags = viewerDept as {
    is_accounts?: boolean | null;
    is_services?: boolean | null;
  } | null;

  const shouldPromptSelfAssign =
    (!!(viewerDeptFlags?.is_accounts) && !c.assigned_to) ||
    (!!(viewerDeptFlags?.is_services) && !c.assigned_services_id);

  const visibleStaffName = (
    row: { id: string; full_name: string | null; email?: string | null; role?: string | null } | null
  ) => {
    if (!row || isHiddenProfile(row, profile.role)) return null;
    return { id: row.id, full_name: row.full_name };
  };
  const accountsUserForHeader = visibleStaffName(
    accountsProfileRow as {
      id: string;
      full_name: string | null;
      email?: string | null;
      role?: string | null;
    } | null
  );
  const servicesUserForHeader = visibleStaffName(
    servicesProfileRow as {
      id: string;
      full_name: string | null;
      email?: string | null;
      role?: string | null;
    } | null
  );

  const canReassign = canReassignClient(profile.role);
  const canEditAttorney = canEditAttorneyAssignment(profile.role);
  const canViewAttorneyField = canViewAssignedAttorneyField(profile.role);
  const canDeleteDocs = canDeleteDocuments(profile.role);

  /* All rows for this client. Uploads groups every file by document type. */
  const [
    { data: documents, error: documentsQueryError },
    { data: cardsRaw },
    { data: remindersRaw },
    { data: communicationsRaw },
    { data: auditLogRaw },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_cards")
      .select(
        "id, creditor_name, merchant_name, card_type, last_four, charge_amount_cents, authorization_status, created_at, added_by, collection_letter_doc_id"
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("reminders")
      .select("id, description, due_date, completed, cancelled, completed_at, assigned_to, appointment_type, notes")
      .eq("client_id", clientId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase
      .from("communications")
      .select(
        "id, type, direction, subject, body, sent_at, duration_seconds, recorded_by, ringcentral_call_id, is_pinned"
      )
      .eq("client_id", clientId)
      .order("sent_at", { ascending: false })
      .limit(500),
    supabase
      .from("audit_log")
      .select("id, action, new_value, performed_by, performed_by_name, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (documentsQueryError) {
    console.error("documents query error:", documentsQueryError);
  }

  const commRecorderIds = new Set<string>();
  for (const c of communicationsRaw ?? []) {
    if (c.recorded_by) commRecorderIds.add(c.recorded_by as string);
  }
  const uploaderIds = new Set<string>();
  for (const d of documents ?? []) {
    if (d.uploaded_by) uploaderIds.add(d.uploaded_by as string);
  }
  const allIds = new Set([...Array.from(commRecorderIds), ...Array.from(uploaderIds)]);
  const letterDocIds = Array.from(
    new Set(
      (cardsRaw ?? [])
        .map((row) => row.collection_letter_doc_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  );

  const nameById: Record<string, string> = {};
  const letterDocById: Record<string, { file_name: string; storage_path: string }> = {};

  const [{ data: profs }, { data: letterDocs }] = await Promise.all([
    allIds.size > 0
      ? supabase.from("profiles").select("id, full_name").in("id", Array.from(allIds))
      : Promise.resolve({ data: null as { id: string; full_name: string | null }[] | null }),
    letterDocIds.length > 0
      ? supabase
          .from("documents")
          .select("id, file_name, storage_path")
          .in("id", letterDocIds)
      : Promise.resolve({ data: null as { id: string; file_name: string; storage_path: string }[] | null }),
  ]);
  for (const p of profs ?? []) {
    nameById[p.id] = p.full_name?.trim() || "—";
  }
  for (const d of letterDocs ?? []) {
    letterDocById[d.id as string] = {
      file_name: d.file_name as string,
      storage_path: d.storage_path as string,
    };
  }

  const hiddenActors = await loadHiddenActors(profile.role);
  const activityLogData = (auditLogRaw ?? []).map((a) => ({
    id: a.id as string,
    action: (a.action as string | null) ?? null,
    new_value: a.new_value,
    performed_by_name: redactActorName(
      (a.performed_by_name as string | null) ?? null,
      (a.performed_by as string | null) ?? null,
      hiddenActors
    ),
    created_at: a.created_at as string,
  }));

  // Legacy system-generated notes (stage changes, role assignments, and
  // appointment creates) used to be written into communications as type="note".
  // They now live in audit_log only; hide any leftover rows from Notes views.
  const isLegacySystemNote = (row: { type?: unknown; body?: unknown }): boolean => {
    if ((row.type as string) !== "note") return false;
    const body = String(row.body ?? "");
    return (
      body.startsWith("Stage changed to:") ||
      body.startsWith("Appointment scheduled:") ||
      / assigned as /.test(body) ||
      /self-assigned as /.test(body) ||
      /assigned themselves as /.test(body)
    );
  };

  const communicationRows = (communicationsRaw ?? [])
    .filter((c) => !isLegacySystemNote(c))
    .map((c) => ({
      id: c.id as string,
      type: c.type as string,
      direction: c.direction as string,
      subject: c.subject as string | null,
      body: c.body as string | null,
      sent_at: c.sent_at as string | null,
      duration_seconds: c.duration_seconds as number | null,
      recorded_by: (c.recorded_by as string | null) ?? null,
      loggedByName: c.recorded_by
        ? nameById[c.recorded_by as string]?.trim() || "System"
        : "System",
      is_pinned: (c.is_pinned as boolean | null) ?? false,
    }));

  const hasRingCentralAutoLog = (communicationsRaw ?? []).some(
    (row) => !!(row as { ringcentral_call_id?: string | null }).ringcentral_call_id
  );

  const docs = (documents ?? []) as DocRow[];
  const hasPoaDocument = docs.some((d) =>
    isPoaDocumentTypeForCs(d.document_type)
  );
  const hasCcAuthorization = hasCcAuthorizationOnRecord(
    docs.map((d) => d.document_type)
  );
  const openCcAuthUpload = sp.upload === "cc_authorization";
  const documentsForDocumentsTab: DocumentListItem[] = docs.map((d) => ({
    id: d.id,
    file_name: d.file_name,
    mime_type: d.mime_type,
    document_type: (d.document_type as string | null)?.trim() || "upload",
    created_at: d.created_at,
    uploaded_by: d.uploaded_by,
    file_size_bytes: d.file_size_bytes,
    storage_path: d.storage_path,
    notes: d.notes,
    is_collection_letter: d.is_collection_letter,
  }));

  const uploaderNames: Record<string, string> = {};
  for (const id of Array.from(uploaderIds)) {
    uploaderNames[id] = nameById[id] ?? "—";
  }

  /* Client Services checklist for the sidebar, behind the same gate as the
   * Priority board. POA signals come from the documents already loaded above
   * rather than a second query. */
  const csChecklist = canAccessPriorityBoard(
    profile.role,
    viewerDeptFlags?.is_services
  )
    ? await fetchCsChecklistForClient(supabase, {
        clientId,
        poaSignedAt: (c.poa_signed_at as string | null) ?? null,
        hasPoaDocument,
      })
    : null;
  const showCsChecklist =
    csChecklist !== null &&
    shouldShowCsChecklistCard(
      (c.stage as string | null) ?? null,
      csChecklist.hasAnyRow
    );

  const [{ data: staff }, { data: attys }, { data: sidebarStaff }] = await Promise.all([
    canReassign
      ? supabase
          .from("profiles")
          .select(
            "id, full_name, email, is_accounts, is_services"
          )
          .eq("is_active", true)
          .or("is_accounts.eq.true,is_services.eq.true")
          .not(
            "email",
            "in",
            `(${HIDDEN_FROM_NON_DEV_EMAILS.map((email) => `"${email}"`).join(",")})`
          )
          .order("full_name", { ascending: true })
      : Promise.resolve({
          data: null as
            | {
                id: string;
                full_name: string | null;
                email: string | null;
                is_accounts: boolean | null;
                is_services: boolean | null;
              }[]
            | null,
        }),
    canEditAttorney
      ? supabase
          .from("profiles")
          .select("id, full_name, email, is_default_attorney")
          .eq("role", "attorney")
          .eq("is_active", true)
          .order("full_name", { ascending: true })
      : Promise.resolve({
          data: null as
            | {
                id: string;
                full_name: string | null;
                is_default_attorney: boolean | null;
              }[]
            | null,
        }),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["dev", "admin", "acct_manager", "manager"])
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);
  let staffOptions = staff ?? [];
  if (canReassign) {
    const assigneeIds = [
      c.assigned_to,
      c.assigned_services_id,
    ].filter((id): id is string => typeof id === "string" && id.length > 0);
    const missingIds = assigneeIds.filter(
      (id) => !staffOptions.some((s) => s.id === id)
    );
    if (missingIds.length > 0) {
      const { data: missingStaff } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, role, is_accounts, is_services"
        )
        .in("id", missingIds);
      if (missingStaff?.length) {
        const visibleMissing = missingStaff.filter(
          (row) => !isHiddenProfile(row, profile.role)
        );
        staffOptions = [...staffOptions, ...visibleMissing];
        staffOptions.sort((a, b) =>
          (a.full_name ?? "").localeCompare(b.full_name ?? "")
        );
      }
    }
  }
  const sidebarStaffOptions = (sidebarStaff ?? []).filter(
    (row) => !isHiddenProfile({ email: row.email as string | null, role: row.role as string | null }, profile.role)
  );
  const attorneyOptions = attys ?? [];

  const assignedUser = c.assigned_user as
    | { full_name: string | null; role: string | null; email?: string | null }
    | null
    | undefined;
  const assigneeName = isHiddenProfile(
    { email: assignedUser?.email, role: assignedUser?.role },
    profile.role
  )
    ? null
    : assignedUser?.full_name?.trim() || null;
  const assigneeRole = (assignedUser?.role as string | null) ?? null;

  const servicesAssigneeName = servicesUserForHeader?.full_name?.trim() || null;

  const displayName =
    `${String(c.first_name ?? "")} ${String(c.last_name ?? "")}`.trim() || "Client";

  const performerName = profile.full_name?.trim() || user.email || "Staff";

  const _allSidebarNotes = (communicationsRaw ?? []).filter(
    (row) => (row.type as string) === "note" && !isLegacySystemNote(row)
  );
  const _pinnedSidebarNotes = _allSidebarNotes.filter((row) => !!(row.is_pinned as boolean));
  const _unpinnedSidebarNotes = _allSidebarNotes
    .filter((row) => !(row.is_pinned as boolean))
    .slice(0, 3);
  const commNotesForSidebar: SidebarCommNoteRow[] = [
    ..._pinnedSidebarNotes,
    ..._unpinnedSidebarNotes,
  ].map((row) => ({
    id: row.id as string,
    body: String(row.body ?? ""),
    sent_at: row.sent_at as string | null,
    author_name: row.recorded_by
      ? nameById[row.recorded_by as string]?.trim() || "System"
      : "System",
    is_pinned: (row.is_pinned as boolean | null) ?? false,
  }));

  const rawSf = (c.spouse_first_name as string | null) ?? null;
  const rawSl = (c.spouse_last_name as string | null) ?? null;
  const rawSpouseName = (c.spouse_name as string | null) ?? null;
  let spouseFirst = rawSf?.trim() || "";
  let spouseLast = rawSl?.trim() || "";
  if (!spouseFirst && !spouseLast && rawSpouseName?.trim()) {
    const parts = rawSpouseName.trim().split(/\s+/);
    spouseFirst = parts[0] ?? "";
    spouseLast = parts.length > 1 ? parts.slice(1).join(" ") : "";
  }

  const attorneyRow = c.attorney as
    | { full_name: string | null; email: string | null }
    | null
    | undefined;

  const accountClient: AccountTabClient = {
    first_name: (c.first_name as string | null) ?? null,
    middle_initial: (c.middle_initial as string | null) ?? null,
    last_name: (c.last_name as string | null) ?? null,
    nickname: (c.nickname as string | null) ?? null,
    spouse_first_name: spouseFirst || null,
    spouse_last_name: spouseLast || null,
    spouse_name: rawSpouseName,
    spouse_nickname: (c.spouse_nickname as string | null) ?? null,
    verbal_password: (c.verbal_password as string | null) ?? null,
    email: (c.email as string | null) ?? null,
    phone: (c.phone as string | null) ?? null,
    phone_mobile: (c.phone_mobile as string | null) ?? null,
    phone_work: (c.phone_work as string | null) ?? null,
    phone_home: (c.phone_home as string | null) ?? null,
    street_address: (c.street_address as string | null) ?? null,
    city: (c.city as string | null) ?? null,
    state: (c.state as string | null) ?? null,
    zip_code: (c.zip_code as string | null) ?? null,
  };

  const settingsClient: ClientSettingsTabClient = {
    stage: (c.stage as string | null) ?? null,
    assigned_to: (c.assigned_to as string | null) ?? null,
    assigned_services_id: (c.assigned_services_id as string | null) ?? null,
    attorney_id: (c.attorney_id as string | null) ?? null,
    attorney: attorneyRow
      ? {
          full_name: attorneyRow.full_name ?? null,
          email: attorneyRow.email ?? null,
        }
      : null,
    is_active: (c.is_active as boolean | null) ?? null,
  };

  const deliveryClient = {
    first_name: (c.first_name as string | null) ?? null,
    last_name: (c.last_name as string | null) ?? null,
    email: (c.email as string | null) ?? null,
    stage: String(c.stage ?? ""),
  };

  const upcomingEmails = await listUpcomingEmailsForClient(supabase, clientId);

  const remindersForSidebar = (remindersRaw ?? []).map((r) => ({
    id: r.id as string,
    description: r.description as string,
    due_date: r.due_date as string | null,
    completed: !!r.completed,
    cancelled: !!(r as { cancelled?: boolean }).cancelled,
    completed_at: ((r as { completed_at?: string | null }).completed_at as string | null) ?? null,
    assigned_to: ((r as { assigned_to?: string | null }).assigned_to as string | null) ?? null,
    appointment_type: ((r as { appointment_type?: string | null }).appointment_type as string | null) ?? null,
    notes: ((r as { notes?: string | null }).notes as string | null) ?? null,
  }));

  return (
    <main className="mx-auto min-w-0 max-w-[1600px] overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <ClientViewLogger clientId={clientId} userId={user.id} userName={performerName} />

      <div className="mb-4">
        <ClientBackButton />
      </div>

      <nav className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        <Link href="/dashboard" className="font-medium hover:text-[#A87830]">
          Dashboard
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <Link href="/clients" className="font-medium hover:text-[#A87830]">
          Clients
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="font-semibold text-slate-900 dark:text-slate-200">{displayName}</span>
      </nav>

      <ClientStageHeader
        displayName={displayName}
        midName={midNameFromEmbed((c as { mids?: unknown }).mids)}
        clientId={clientId}
        stage={(c.stage as string | null) ?? null}
        performerId={user.id}
        performerName={performerName}
        userRole={profile.role}
        assignedTo={(c.assigned_to as string | null) ?? null}
        assignedUserName={assigneeName}
        assignedServicesId={(c.assigned_services_id as string | null) ?? null}
        accountsUser={accountsUserForHeader}
        servicesUser={servicesUserForHeader}
        shouldPromptSelfAssign={shouldPromptSelfAssign}
        viewerDept={{
          is_accounts: !!viewerDeptFlags?.is_accounts,
          is_services: !!viewerDeptFlags?.is_services,
        }}
        poaSignedAt={(c.poa_signed_at as string | null) ?? null}
        hasPoaDocument={hasPoaDocument}
        hasCcAuthorization={hasCcAuthorization}
        refundPrefill={refundPrefillFromCards(
          (cardsRaw ?? []) as {
            charge_amount_cents?: number | null;
            merchant_name?: string | null;
          }[],
          null
        )}
      />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="order-1 min-w-0 flex-1 space-y-8">
          <div className="-mx-4 overflow-x-auto overflow-y-hidden border-b border-slate-200 px-4 pb-px [-webkit-overflow-scrolling:touch] dark:border-[#2E2E2E] sm:-mx-6 sm:px-6 md:mx-0 md:overflow-visible md:px-0">
            <nav className="flex min-w-max gap-0 md:min-w-0">
              {VISIBLE_TABS.map((t) => (
                <Link
                  key={t.id}
                  href={tabHref(clientId, t.id)}
                  className={tabClass(tab === t.id)}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>

          <ErrorBoundary>
            {tab === "account" ? (
              <AccountTabForm
                key={clientId}
                clientId={clientId}
                client={accountClient}
                accountRevision={String((c.updated_at as string | null) ?? "")}
              />
            ) : null}

            {tab === "documents" ? (
              <div className="space-y-4">
                {isEsignFeatureEnabled() && canUseEsignStaffUi(profile.role) ? (
                  <EsignDripSection
                    clientId={clientId}
                    clientFirstName={
                      String(c.first_name ?? "").trim() || String(c.nickname ?? "").trim()
                    }
                    clientLastName={String(c.last_name ?? "").trim()}
                    advisorName={assigneeName ?? ""}
                    canSend={canShowEsignActions((c.stage as string | null) ?? null)}
                  />
                ) : null}
                <DocumentsTab
                  openCcAuthUpload={openCcAuthUpload}
                  key={`${clientId}-docs-${documentsForDocumentsTab.length}-${String(
                    c.updated_at ?? ""
                  )}`}
                  clientId={clientId}
                  initialDocuments={documentsForDocumentsTab}
                  uploaderNames={uploaderNames}
                  canDeleteDocs={canDeleteDocs}
                  currentUserId={user.id}
                />
              </div>
            ) : null}

            {tab === "campaigns" ? (
              <EmailActivityTabClient
                clientId={clientId}
                userRole={profile.role}
                performerName={performerName}
                upcomingEmails={upcomingEmails}
                stage={(c.stage as string | null) ?? null}
              />
            ) : null}

            {tab === "communications" ? (
              <CommunicationsTab
                clientId={clientId}
                initialRows={communicationRows}
                hasRingCentralAutoLog={hasRingCentralAutoLog}
                activityLog={activityLogData}
                templateMergeContext={{
                  clientName: displayName,
                  firstName: String(c.first_name ?? "").trim(),
                  assignedUser: assigneeName?.trim() || "—",
                  stageKey: String(c.stage ?? "lead"),
                }}
                currentUserId={user.id}
                isAdminOrDev={profile.role === "dev" || profile.role === "admin"}
              />
            ) : null}

            {tab === "billing" ? (
              <BillingTabContent
                clientId={clientId}
                userRole={profile.role}
                cards={(cardsRaw ?? []).map((row) => {
                  const docId = row.collection_letter_doc_id as string | null;
                  const meta = docId ? letterDocById[docId] : undefined;
                  return {
                    id: row.id as string,
                    creditor_name: row.creditor_name as string,
                    merchant_name: (row.merchant_name as string | null) ?? null,
                    card_type: row.card_type as string,
                    last_four: row.last_four as string,
                    charge_amount_cents:
                      (row as { charge_amount_cents?: number })
                        .charge_amount_cents ?? 0,
                    authorization_status:
                      (row as { authorization_status?: string | null })
                        .authorization_status ?? "pre_auth",
                    created_at: row.created_at as string | null,
                    added_by: row.added_by as string | null,
                    collection_letter_doc_id: docId,
                    collection_letter_file_name: meta?.file_name ?? null,
                    collection_letter_storage_path: meta?.storage_path ?? null,
                  };
                })}
              />
            ) : null}

            {tab === "settings" ? (
              <ClientSettingsTab
                key={`settings-${String(c.updated_at ?? c.id)}`}
                clientId={clientId}
                client={settingsClient}
                canReassignClient={canReassign}
                canViewAssignedAttorneyField={canViewAttorneyField}
                viewerRole={profile.role}
                userRole={profile.role}
                staffOptions={staffOptions}
                attorneyOptions={attorneyOptions}
                assigneeName={assigneeName}
                assigneeRole={assigneeRole}
                servicesAssigneeName={servicesAssigneeName}
                      />
            ) : null}
          </ErrorBoundary>
        </div>

        <ClientRightSidebar
          className="order-2"
          clientId={clientId}
          clientStage={(c.stage as string | null) ?? null}
          reminders={remindersForSidebar}
          auditPerformedByName={performerName}
          commNotes={commNotesForSidebar}
          currentUserId={user.id}
          currentRole={profile.role}
          csChecklistSlot={
            showCsChecklist && csChecklist ? (
              <CsChecklistCard
                clientId={clientId}
                items={csChecklist.items}
                completeCount={csChecklist.completeCount}
                nextUpLabel={csChecklist.nextUpLabel}
              />
            ) : null
          }
          staffOptions={sidebarStaffOptions.map((m) => ({
            id: m.id as string,
            full_name: m.full_name as string | null,
          }))}
          accountInfo={{
            created_at: (c.created_at as string | null) ?? null,
            id: c.id as string,
            verbal_password: (c.verbal_password as string | null) ?? null,
            updated_at: (c.updated_at as string | null) ?? null,
                    assigned_to: (c.assigned_to as string | null) ?? null,
            assigned_user: assignedUser
              ? { full_name: assignedUser.full_name ?? null }
              : null,
            attorney: attorneyRow
              ? {
                  full_name: attorneyRow.full_name ?? null,
                  email: attorneyRow.email ?? null,
                }
              : null,
          }}
        />
      </div>
    </main>
  );
  } catch (error) {
    console.error("Client profile error:", error);
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-lg font-bold text-red-600">Something went wrong</h1>
        <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
          {toUserFacingError(error instanceof Error ? error.message : error)}
        </p>
      </div>
    );
  }
}
