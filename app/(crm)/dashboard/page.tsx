import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { toUserFacingError } from "@/lib/user-facing-error";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { DashboardNotificationPermission } from "./DashboardNotificationPermission";
import { AdminDashboard } from "./AdminDashboard";
import { ComplianceDashboard } from "./ComplianceDashboard";
import { AccountsDashboard } from "./AccountsDashboard";
import { ServicesDashboard } from "./ServicesDashboard";
import { DashboardClientTable } from "./DashboardClientTable";
import type {
  AlertClientRow,
  DashboardClientRow,
  TeamActivityRow,
  TodayAppointmentRow,
} from "./dashboard-types";

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
    .select("id, role, full_name, is_compliance, is_accounts, is_services")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const isAdmin = ["dev", "admin"].includes(profile.role || "");
  const isDev = profile.role === "dev";
  const isCompliance = !isAdmin && !!profile.is_compliance;
  const isAccounts =
    !isAdmin && !!profile.is_accounts && !profile.is_compliance;
  const isServices =
    !isAdmin && !!profile.is_services && !profile.is_accounts;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayStartISO = todayStart.toISOString();
  const todayEndISO = todayEnd.toISOString();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const fourteenDaysAgo = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();
  const twentyOneDaysAgo = new Date(
    Date.now() - 21 * 24 * 60 * 60 * 1000
  ).toISOString();

  const firstName = profile.full_name?.split(" ")[0];

  let teamActivity: TeamActivityRow[] = [];
  let rnaClients: AlertClientRow[] = [];
  let stuckClients: AlertClientRow[] = [];
  let missingPoa: AlertClientRow[] = [];
  let emailDispatchDisabled = false;

  let myComplianceClients: DashboardClientRow[] = [];
  let missingCcAuth: DashboardClientRow[] = [];

  let myAmClients: DashboardClientRow[] = [];
  let rnaMyClients: DashboardClientRow[] = [];

  let mySvcClients: DashboardClientRow[] = [];
  let poaOverdue: DashboardClientRow[] = [];

  let myApptToday: TodayAppointmentRow[] = [];

  if (isAdmin) {
    const admin = createServiceClient();

    const [teamActivityRes, rnaRes, stuckRes, missingPoaRes] =
      await Promise.all([
      admin
        .from("audit_log")
        .select(
          `
          action, new_value, created_at,
          performed_by_name,
          client:client_id(first_name, last_name)
        `
        )
        .eq("action", "stage_advanced")
        .gte("created_at", todayStartISO)
        .order("created_at", { ascending: false })
        .limit(15),
      admin
        .from("clients")
        .select("id, first_name, last_name, stage_entered_at")
        .eq("stage", "welcome_packet")
        .eq("sub_status", "rna")
        .eq("is_active", true)
        .limit(5),
      admin
        .from("clients")
        .select("id, first_name, last_name, stage, stage_entered_at")
        .eq("is_active", true)
        .in("stage", ["welcome_packet", "lead"])
        .lt("stage_entered_at", sevenDaysAgo)
        .limit(5),
      admin
        .from("clients")
        .select("id, first_name, last_name, stage_entered_at")
        .eq("stage", "client_services")
        .eq("is_active", true)
        .is("poa_signed_at", null)
        .lt("stage_entered_at", fourteenDaysAgo)
        .limit(5),
    ]);

    teamActivity = asTeamActivity(teamActivityRes.data ?? []);
    rnaClients = (rnaRes.data ?? []) as AlertClientRow[];
    stuckClients = (stuckRes.data ?? []) as AlertClientRow[];
    missingPoa = (missingPoaRes.data ?? []) as AlertClientRow[];

    const { data: dispatchSetting } = await admin
      .from("crm_settings")
      .select("value")
      .eq("key", "email_sequences_enabled")
      .maybeSingle();
    emailDispatchDisabled = dispatchSetting?.value !== "true";
  }

  if (isDev) {
    const admin = createServiceClient();
    const { data: funnelClients } = await admin
      .from("clients")
      .select("id, first_name, last_name, phone_mobile, stage_entered_at, stage")
      .eq("is_active", true)
      .in("stage", [
        "lead",
        "welcome_packet",
        "client_services",
        "compliance_verification",
      ])
      .order("stage_entered_at", { ascending: true });

    const clientIds = funnelClients?.map((c) => c.id as string) ?? [];
    const { data: ccAuthDocs } =
      clientIds.length > 0
        ? await admin
            .from("documents")
            .select("client_id")
            .in("client_id", clientIds)
            .eq("document_type", "cc_authorization")
        : { data: [] as { client_id: string }[] };

    const ccAuthClientIds = new Set(
      (ccAuthDocs ?? []).map((d) => d.client_id as string)
    );
    missingCcAuth =
      (funnelClients?.filter(
        (c) => !ccAuthClientIds.has(c.id as string)
      ) as DashboardClientRow[]) ?? [];
  }

  if (isCompliance) {
    const { data: myComplianceClientsData } = await supabase
      .from("clients")
      .select(
        "id, first_name, last_name, phone_mobile, stage_entered_at, stage, shape_contact_id"
      )
      .eq("stage", "compliance_verification")
      .eq("assigned_compliance_id", profile.id)
      .eq("is_active", true)
      .order("stage_entered_at", { ascending: true });

    myComplianceClients = (myComplianceClientsData ??
      []) as DashboardClientRow[];

    const { data: appts } = await supabase
      .from("reminders")
      .select(
        `
        id, description, due_date,
        appointment_type,
        client:client_id(id, first_name, last_name)
      `
      )
      .eq("assigned_to", profile.id)
      .eq("completed", false)
      .gte("due_date", todayStartISO)
      .lte("due_date", todayEndISO)
      .order("due_date", { ascending: true });

    myApptToday = asTodayAppointments(appts ?? []);
  }

  if (isAccounts) {
    const [{ data: amData }, { data: rnaData }, { data: appts }] =
      await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, first_name, last_name, phone_mobile, stage_entered_at, sub_status"
          )
          .eq("stage", "welcome_packet")
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
            client:client_id(id, first_name, last_name)
          `
          )
          .eq("assigned_to", profile.id)
          .eq("completed", false)
          .gte("due_date", todayStartISO)
          .lte("due_date", todayEndISO)
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
            client:client_id(id, first_name, last_name)
          `
          )
          .eq("assigned_to", profile.id)
          .eq("completed", false)
          .gte("due_date", todayStartISO)
          .lte("due_date", todayEndISO)
          .order("due_date", { ascending: true }),
      ]);

    mySvcClients = (svcData ?? []) as DashboardClientRow[];
    poaOverdue = (overdueData ?? []) as DashboardClientRow[];
    myApptToday = asTodayAppointments(appts ?? []);
  }

  const showDeptView =
    isCompliance || isAccounts || isServices;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Dashboard" />
      <DashboardNotificationPermission />
      <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto p-6">
        {isAdmin ? (
          <AdminDashboard
            teamActivity={teamActivity}
            rnaClients={rnaClients}
            stuckClients={stuckClients}
            missingPoa={missingPoa}
            emailDispatchDisabled={emailDispatchDisabled}
          />
        ) : null}

        {isDev ? (
          <DashboardClientTable
            title="Missing CC Authorization"
            subtitle="Informational only — does not block packet send or stage advance"
            clients={missingCcAuth}
            emptyMessage="All active funnel clients have CC authorization on file ✓"
            columns={["name", "phone", "days_in_stage"]}
            alertColor="amber"
          />
        ) : null}

        {isCompliance ? (
          <ComplianceDashboard
            firstName={firstName}
            myComplianceClients={myComplianceClients}
            myApptToday={myApptToday}
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
          <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-[#1a3550] dark:bg-[#0d2035]">
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
