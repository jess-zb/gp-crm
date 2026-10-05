import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { toUserFacingError } from "@/lib/user-facing-error";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { DashboardNotificationPermission } from "./DashboardNotificationPermission";
import { AdminDashboard } from "./AdminDashboard";
import { AccountsDashboard } from "./AccountsDashboard";
import { ServicesDashboard } from "./ServicesDashboard";
import { loadHiddenActors, redactActorName } from "@/lib/auth/hidden-actor";
import type {
  DashboardClientRow,
  TeamActivityRow,
  TodayAppointmentRow,
} from "./dashboard-types";
import { officeDayStartIso, officeTodayYmd, officeWeekBounds } from "@/lib/time/office-calendar";

function normalizeClientJoin<T extends { client?: unknown }>(
  rows: T[]
): T[] {
  return rows.map((row) => {
    const raw = row.client;
    if (Array.isArray(raw)) {
      return { ...row, client: (raw[0] ?? null) as T["client"] };
    }
    return row;
  });
}

function asTeamActivity(rows: unknown): TeamActivityRow[] {
  return normalizeClientJoin(rows as { client?: unknown }[]) as TeamActivityRow[];
}

function asTodayAppointments(rows: unknown): TodayAppointmentRow[] {
  return normalizeClientJoin(
    rows as { client?: unknown }[]
  ) as TodayAppointmentRow[];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile: authProfile, error: profileError } = await getProfileForUser(
    supabase,
    user
  );
  if (profileError) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-lg font-semibold text-red-600">
          Could not load your profile
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {toUserFacingError(profileError)}
        </p>
      </main>
    );
  }

  if (!authProfile) redirect("/login");
  if (authProfile.role === "client") redirect("/portal");
  if (authProfile.role === "attorney") redirect("/attorney/cases");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, is_accounts, is_services")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const isAdmin = ["dev", "admin"].includes(profile.role || "");
  const isAccounts = !isAdmin && !!profile.is_accounts;
  const isServices =
    !isAdmin && !!profile.is_services && !profile.is_accounts;

  const todayStartISO = officeDayStartIso(officeTodayYmd()) ?? new Date().toISOString();
  const officeWeek = officeWeekBounds();
  const weekStartISO = officeWeek?.startIso ?? todayStartISO;
  const weekEndISO = officeWeek?.endIso ?? todayStartISO;
  const twentyOneDaysAgo = new Date(
    Date.now() - 21 * 24 * 60 * 60 * 1000
  ).toISOString();

  const firstName = profile.full_name?.split(" ")[0];

  let teamActivity: TeamActivityRow[] = [];
  let missingCcAuth: DashboardClientRow[] = [];

  let myAmClients: DashboardClientRow[] = [];
  let rnaMyClients: DashboardClientRow[] = [];

  let mySvcClients: DashboardClientRow[] = [];
  let poaOverdue: DashboardClientRow[] = [];

  let myApptToday: TodayAppointmentRow[] = [];
  let movedToday = 0;

  if (isAdmin) {
    const admin = createServiceClient();

    const [teamActivityRes, apptRes, movedCountRes, funnelRes] =
      await Promise.all([
      admin
        .from("audit_log")
        .select(
          `
          action, new_value, created_at,
          performed_by,
          performed_by_name,
          client:client_id(id, first_name, last_name, state, zip_code)
        `
        )
        .eq("action", "stage_advanced")
        .gte("created_at", todayStartISO)
        .order("created_at", { ascending: false })
        .limit(15),
      admin
        .from("reminders")
        .select(
          `
          id, description, due_date,
          appointment_type,
          client:client_id(id, first_name, last_name, state, zip_code)
        `
        )
        .eq("completed", false)
        .eq("cancelled", false)
        .gte("due_date", weekStartISO)
        .lte("due_date", weekEndISO)
        .order("due_date", { ascending: true })
        .limit(80),
      admin
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "stage_advanced")
        .gte("created_at", todayStartISO),
      admin
        .from("clients")
        .select("id, first_name, last_name, phone_mobile, stage_entered_at, stage")
        .eq("is_active", true)
        .in("stage", ["lead", "account_manager", "client_services"])
        .order("stage_entered_at", { ascending: true }),
    ]);

    const hiddenActors = await loadHiddenActors(profile.role);
    teamActivity = asTeamActivity(teamActivityRes.data ?? []).map((row) => {
      const actorId = (row as { performed_by?: string | null }).performed_by ?? null;
      return {
        action: row.action,
        created_at: row.created_at,
        new_value: row.new_value,
        client: row.client,
        performed_by_name: redactActorName(row.performed_by_name, actorId, hiddenActors),
      };
    });
    myApptToday = asTodayAppointments(apptRes.data ?? []);
    movedToday = movedCountRes.count ?? teamActivity.length;

    const funnelClients = funnelRes.data;
    const clientIds = funnelClients?.map((c) => c.id as string) ?? [];
    const { data: ccAuthDocs } =
      clientIds.length > 0
        ? await admin
            .from("documents")
            .select("client_id")
            .in("client_id", clientIds)
            .eq("document_type", "cc_authorization")
            .is("archived_at", null)
        : { data: [] as { client_id: string }[] };

    const ccAuthClientIds = new Set(
      (ccAuthDocs ?? []).map((d) => d.client_id as string)
    );
    missingCcAuth =
      (funnelClients?.filter(
        (c) => !ccAuthClientIds.has(c.id as string)
      ) as DashboardClientRow[]) ?? [];
  }

  if (isAccounts) {
    const [{ data: amData }, { data: rnaData }, { data: appts }] =
      await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, first_name, last_name, phone_mobile, stage_entered_at, sub_status"
          )
          .eq("stage", "account_manager")
          .eq("assigned_to", profile.id)
          .eq("is_active", true)
          .order("stage_entered_at", { ascending: true }),
        supabase
          .from("clients")
          .select("id, first_name, last_name, phone_mobile, stage_entered_at")
          .eq("assigned_to", profile.id)
          .eq("sub_status", "rna")
          .eq("is_active", true),
        supabase
          .from("reminders")
          .select(
            `
            id, description, due_date,
            appointment_type,
            client:client_id(id, first_name, last_name, state, zip_code)
          `
          )
          .eq("assigned_to", profile.id)
          .eq("completed", false)
          .eq("cancelled", false)
          .gte("due_date", weekStartISO)
          .lte("due_date", weekEndISO)
          .order("due_date", { ascending: true }),
      ]);

    myAmClients = (amData ?? []) as DashboardClientRow[];
    rnaMyClients = (rnaData ?? []) as DashboardClientRow[];
    myApptToday = asTodayAppointments(appts ?? []);
  }

  if (isServices) {
    const [{ data: svcData }, { data: overdueData }, { data: appts }] =
      await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, first_name, last_name, phone_mobile, stage_entered_at, poa_signed_at"
          )
          .eq("stage", "client_services")
          .eq("assigned_services_id", profile.id)
          .eq("is_active", true)
          .order("stage_entered_at", { ascending: true }),
        supabase
          .from("clients")
          .select("id, first_name, last_name, phone_mobile, stage_entered_at")
          .eq("stage", "client_services")
          .eq("assigned_services_id", profile.id)
          .eq("is_active", true)
          .is("poa_signed_at", null)
          .lt("stage_entered_at", twentyOneDaysAgo),
        supabase
          .from("reminders")
          .select(
            `
            id, description, due_date,
            appointment_type,
            client:client_id(id, first_name, last_name, state, zip_code)
          `
          )
          .eq("assigned_to", profile.id)
          .eq("completed", false)
          .eq("cancelled", false)
          .gte("due_date", weekStartISO)
          .lte("due_date", weekEndISO)
          .order("due_date", { ascending: true }),
      ]);

    mySvcClients = (svcData ?? []) as DashboardClientRow[];
    poaOverdue = (overdueData ?? []) as DashboardClientRow[];
    myApptToday = asTodayAppointments(appts ?? []);
  }

  const showDeptView = isAccounts || isServices;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Dashboard" />
      <DashboardNotificationPermission />
      <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto p-6">
        {isAdmin ? (
          <AdminDashboard
            firstName={firstName}
            teamActivity={teamActivity}
            missingCcAuth={missingCcAuth}
            appointments={myApptToday}
            movedToday={movedToday}
          />
        ) : null}

        {isAccounts ? (
          <AccountsDashboard
            firstName={firstName}
            myAmClients={myAmClients}
            rnaMyClients={rnaMyClients}
            myApptToday={myApptToday}
          />
        ) : null}

        {isServices ? (
          <ServicesDashboard
            firstName={firstName}
            mySvcClients={mySvcClients}
            poaOverdue={poaOverdue}
            myApptToday={myApptToday}
          />
        ) : null}

        {!isAdmin && !showDeptView ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Welcome back{firstName ? `, ${firstName}` : ""}. Your dashboard
              will appear here once department access is configured on your
              profile.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
