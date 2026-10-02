import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import { isHiddenFromRole } from "@/lib/constants/hidden-accounts";
import { inferPipelineFromClientStage, type PipelineKind } from "@/lib/reminders/appointments";
import { AppointmentsView, type AppointmentRow } from "./AppointmentsView";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";

const SERVICE_PIPELINE_STAGES = new Set([
  "client_services",
  "awaiting_collection_letter",
  "case_sent_to_attorneys",
  "mortgage",
]);

function clientRecordFromReminderRow(r: unknown): {
  id: string | null;
  stage: string | null;
  assigned_to: string | null;
  assigned_services_id: string | null;
} | null {
  const client = (r as { client?: unknown }).client;
  const clientObj =
    client && typeof client === "object" && !Array.isArray(client)
      ? (client as Record<string, unknown>)
      : null;
  if (!clientObj) return null;
  return {
    id: (clientObj.id as string | null) ?? null,
    stage: (clientObj.stage as string | null) ?? null,
    assigned_to: (clientObj.assigned_to as string | null) ?? null,
    assigned_services_id: (clientObj.assigned_services_id as string | null) ?? null,
  };
}

export default async function RemindersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, error: profileError } = await getProfileForUser(supabase, user);
  if (profileError || !profile) redirect("/login");
  if (profile.role === "client") redirect("/portal");

  const deptProfile = await getCurrentProfile(supabase);

  const todayStartUtc = `${new Date().toISOString().split("T")[0]}T00:00:00.000Z`;

  const { data: rawReminders, error: remErr } = await supabase
    .from("reminders")
    .select(
      "id, description, due_date, completed, appointment_type, pipeline_type, assigned_to, notes, client:client_id(id, first_name, last_name, stage, phone_mobile, assigned_to, assigned_services_id), assigned:assigned_to(full_name)"
    )
    .eq("completed", false)
    .eq("cancelled", false)
    .gte("due_date", todayStartUtc)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);

  if (remErr) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <CrmPageHeader title="Appointments" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-5">
          <p className="text-sm text-red-600">{remErr.message}</p>
        </main>
      </div>
    );
  }

  const raw = rawReminders ?? [];

  const elevated =
    deptProfile?.role === "dev" ||
    deptProfile?.role === "admin" ||
    profile.role === "dev" ||
    profile.role === "admin";

  const filteredRaw = raw.filter((row) => {
    if (elevated) return true;
    const c = clientRecordFromReminderRow(row);
    // Fail CLOSED: if the client record didn't load, fall back to the
    // strict owner check instead of exposing the row to everyone.
    if (!c?.id) return (row.assigned_to as string | null) === user.id;
    if (deptProfile?.is_accounts) {
      return c.assigned_to === user.id;
    }
    if (deptProfile?.is_services && !deptProfile.is_accounts) {
      return (
        c.stage != null &&
        SERVICE_PIPELINE_STAGES.has(c.stage) &&
        c.assigned_services_id === user.id
      );
    }
    return (row.assigned_to as string | null) === user.id;
  });

  const enriched: AppointmentRow[] = filteredRaw.map((r) => {
    const client = (r as unknown as { client?: unknown }).client;
    const assigned = (r as unknown as { assigned?: unknown }).assigned;
    const clientObj =
      client && typeof client === "object" && !Array.isArray(client)
        ? (client as Record<string, unknown>)
        : null;
    const assignedObj =
      assigned && typeof assigned === "object" && !Array.isArray(assigned)
        ? (assigned as Record<string, unknown>)
        : null;
    const cid = (clientObj?.id as string | null) ?? null;
    const clientName =
      `${(clientObj?.first_name as string | null) ?? ""} ${(clientObj?.last_name as string | null) ?? ""}`.trim() ||
      "—";
    const clientStage = (clientObj?.stage as string | null) ?? null;

    const ptype = r.pipeline_type as string | null;
    const pipeline_type: PipelineKind =
      ptype === "sales" || ptype === "service"
        ? ptype
        : cid && clientStage
          ? inferPipelineFromClientStage(clientStage)
          : "sales";
    return {
      id: r.id as string,
      description: r.description as string,
      due_date: r.due_date as string | null,
      client_id: cid,
      clientName: cid ? clientName : "—",
      clientStage: clientStage,
      assigneeName: (assignedObj?.full_name as string | null)?.trim() || "—",
      assigned_to: (r.assigned_to as string | null) ?? null,
      appointment_type: (r.appointment_type as string | null) ?? null,
      pipeline_type,
      notes: (r.notes as string | null) ?? null,
    };
  });

  const { data: teamRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["dev", "admin", "acct_manager", "manager"])
    .order("full_name", { ascending: true });

  const teamMembers = (teamRows ?? []).filter(
    (row) => !isHiddenFromRole(row.email as string | null, profile.role)
  );

  return (
    <AppointmentsView
      reminders={enriched}
      teamMembers={teamMembers.map((m) => ({
        id: m.id as string,
        full_name: m.full_name as string | null,
      }))}
      currentUserId={user.id}
      currentRole={profile.role}
    />
  );
}
