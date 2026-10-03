import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { STAGE_LABELS } from "@/lib/constants/stages";
import { STAGE_ORDER } from "@/lib/reports/constants";
import {
  buildVelocityRows,
  computeCurrentTenureByStage,
  computeVelocityFromAudits,
} from "@/lib/reports/stage-velocity";
import { canAccessReports, canExportReportsCsv } from "@/lib/roles";
import { isHiddenFromRole } from "@/lib/constants/hidden-accounts";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";
import { ReportsClient } from "./ReportsClient";

export const metadata = {
  title: "Reports | Golden Pathway CRM",
};

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error: profileError } = await getProfileForUser(supabase, user);
  if (profileError || !profile) redirect("/login");

  if (!canAccessReports(profile.role)) {
    redirect("/dashboard");
  }

  const DATA_CUTOFF = "2026-06-02T00:00:00+00:00";

  const [
    clientsRes,
    auditsRes,
    profilesRes,
    stageAdvancesRes,
    completedRemindersRes,
    newClientsRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, stage, created_at, stage_entered_at, assigned_to")
      .eq("is_active", true)
      .gte("created_at", DATA_CUTOFF)
      .limit(25000),
    supabase
      .from("audit_log")
      .select("client_id, created_at, old_value, new_value, action")
      .in("action", ["stage_advanced", "stage_reverted"])
      .gte("created_at", DATA_CUTOFF)
      .order("created_at", { ascending: true })
      .limit(20000),
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, is_accounts, is_services"
      )
      .in("role", ["dev", "admin", "acct_manager"])
      .order("full_name", { ascending: true }),
    supabase
      .from("audit_log")
      .select("performed_by, created_at")
      .eq("action", "stage_advanced")
      .gte("created_at", DATA_CUTOFF)
      .limit(50000),
    supabase
      .from("reminders")
      .select("assigned_to, completed_at")
      .eq("completed", true)
      .not("completed_at", "is", null)
      .gte("completed_at", DATA_CUTOFF)
      .limit(50000),
    supabase
      .from("clients")
      .select("created_at")
      .eq("is_active", true)
      .gte("created_at", DATA_CUTOFF)
      .limit(50000),
  ]);

  const clients = clientsRes.data ?? [];
  const clientsErr = clientsRes.error;

  const stageTotals: Record<string, number> = {};
  let totalActive = 0;
  for (const s of STAGE_ORDER) {
    stageTotals[s] = 0;
  }
  for (const c of clients) {
    const st = String(c.stage ?? "");
    totalActive += 1;
    if (stageTotals[st] !== undefined) {
      stageTotals[st] += 1;
    } else {
      stageTotals[st] = 1;
    }
  }

  const clientCreatedAt = new Map<string, string>();
  for (const c of clients) {
    if (c.id && c.created_at) {
      clientCreatedAt.set(c.id as string, c.created_at as string);
    }
  }

  const auditBuckets = computeVelocityFromAudits(
    (auditsRes.data ?? []) as Parameters<typeof computeVelocityFromAudits>[0],
    clientCreatedAt
  );
  const tenureFallback = computeCurrentTenureByStage(
    clients.map((c) => ({
      stage: String(c.stage ?? ""),
      stage_entered_at: (c.stage_entered_at as string | null) ?? null,
    }))
  );
  const velocityRows = buildVelocityRows(
    auditBuckets,
    tenureFallback,
    (k) => STAGE_LABELS[k] ?? k
  );

  const profiles = profilesRes.data ?? [];
  const tableProfiles = profiles.filter(
    (p) => !isHiddenFromRole(p.email as string | null, profile.role)
  );

  const assignedByUser: Record<string, number> = {};
  for (const p of tableProfiles) {
    assignedByUser[p.id as string] = 0;
  }
  for (const c of clients) {
    const aid = c.assigned_to as string | null;
    if (aid && assignedByUser[aid] !== undefined) {
      assignedByUser[aid] += 1;
    }
  }

  const teamMembers = tableProfiles.map((p) => ({
    id: p.id as string,
    full_name: p.full_name as string | null,
    email: p.email as string | null,
    is_accounts: !!(p.is_accounts as boolean | null),
    is_services: !!(p.is_services as boolean | null),
  }));

  const stageAdvanceEvents = (stageAdvancesRes.data ?? []).map((row) => ({
    performed_by: row.performed_by as string | null,
    created_at: row.created_at as string,
  }));

  const completedAppointments = (completedRemindersRes.data ?? []).map(
    (row) => ({
      assigned_to: row.assigned_to as string | null,
      completed_at: row.completed_at as string,
    })
  );

  const newClientTimestamps = (newClientsRes.data ?? [])
    .map((row) => row.created_at as string)
    .filter(Boolean);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Reports & analytics" />
      {clientsErr ? (
        <p className="mx-auto w-full max-w-7xl px-4 text-sm text-red-600 sm:px-6">
          {clientsErr.message}
        </p>
      ) : null}
      <ReportsClient
        stageTotals={stageTotals}
        totalActive={totalActive}
        velocityRows={velocityRows}
        teamMembers={teamMembers}
        assignedByUser={assignedByUser}
        stageAdvanceEvents={stageAdvanceEvents}
        completedAppointments={completedAppointments}
        newClientTimestamps={newClientTimestamps}
        canExportCsv={canExportReportsCsv(profile.role)}
      />
    </div>
  );
}
