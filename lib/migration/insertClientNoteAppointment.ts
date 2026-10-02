import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildReminderInsertRow } from "@/lib/reminders/workflow";

/**
 * Safe inserts for Shape → zb-crm migration.
 * Matches required DB columns + defaults used in:
 * - `app/(crm)/clients/new/page.tsx`, `import-actions.ts`
 * - `CommunicationsTab.tsx` / `ClientRightSidebar.tsx` (notes)
 * - `app/(crm)/reminders/actions.ts` (`createReminder` row shape)
 *
 * Use **service role** client (bypasses RLS). Load env in scripts: `import "dotenv/config"` or pass URL/key explicitly.
 */

export function createMigrationSupabaseClient(overrides?: {
  url?: string;
  serviceRoleKey?: string;
}): SupabaseClient {
  const url =
    overrides?.url?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const key =
    overrides?.serviceRoleKey?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Missing Supabase URL or service role key (set NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function nonEmptyName(v: string | null | undefined, fallback: string): string {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : fallback;
}

export type MigrationClientInput = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  /** Stored as-is except trimming; optional normalize to match CRM display format */
  phone_mobile?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  shape_contact_id?: string | null;
  /** Shape CRM lead id (optional; distinct from `shape_contact_id` when both exist). */
  shape_lead_id?: string | null;
  assigned_to?: string | null;
  assigned_compliance_id?: string | null;
  stage?: string;
  is_active?: boolean;
};

export type MigrationNoteInput = {
  body: string;
  /** ISO string; defaults to now */
  sent_at?: string;
  /** If set, upserts on unique `communications.shape_note_id` */
  shape_note_id?: string | null;
  recorded_by?: string | null;
};

export type MigrationAppointmentInput = {
  /** Maps to `reminders.description` (required in DB) */
  description: string;
  /** ISO timestamptz string or null */
  due_date?: string | null;
  appointment_type?: string | null;
  pipeline_type?: "sales" | "service" | null;
  assigned_to?: string | null;
  /** Profile id of importer; omit/null for system-only migration */
  created_by?: string | null;
};

export type InsertClientNoteAppointmentResult =
  | {
      ok: true;
      clientId: string;
      noteId: string | null;
      appointmentId: string | null;
    }
  | {
      ok: false;
      error: string;
      step: "client" | "note" | "appointment";
    };

/**
 * Inserts a client row, then optionally a communications note and/or a reminder (“appointment”).
 * Order: client → note → appointment (each depends on `clientId`).
 */
export async function insertClientNoteAppointment(
  supabase: SupabaseClient,
  args: {
    client: MigrationClientInput;
    note?: MigrationNoteInput | null;
    appointment?: MigrationAppointmentInput | null;
  }
): Promise<InsertClientNoteAppointmentResult> {
  const first_name = nonEmptyName(args.client.first_name, "Unknown");
  const last_name = nonEmptyName(args.client.last_name, "Unknown");
  const stage = (args.client.stage ?? "lead").trim() || "lead";
  const is_active = args.client.is_active ?? true;

  const email =
    typeof args.client.email === "string" && args.client.email.trim()
      ? args.client.email.trim().toLowerCase()
      : null;

  const row: Record<string, unknown> = {
    first_name,
    last_name,
    email,
    phone:
      typeof args.client.phone_mobile === "string" && args.client.phone_mobile.trim()
        ? args.client.phone_mobile.trim()
        : null,
    phone_mobile:
      typeof args.client.phone_mobile === "string" && args.client.phone_mobile.trim()
        ? args.client.phone_mobile.trim()
        : null,
    street_address:
      typeof args.client.street_address === "string" && args.client.street_address.trim()
        ? args.client.street_address.trim()
        : null,
    city:
      typeof args.client.city === "string" && args.client.city.trim()
        ? args.client.city.trim()
        : null,
    state:
      typeof args.client.state === "string" && args.client.state.trim()
        ? args.client.state.trim()
        : null,
    zip_code:
      typeof args.client.zip_code === "string" && args.client.zip_code.trim()
        ? args.client.zip_code.trim()
        : null,
    stage,
    is_active,
  };

  const sid = args.client.shape_contact_id?.trim();
  if (sid) row.shape_contact_id = sid;

  const lid = args.client.shape_lead_id?.trim();
  if (lid) row.shape_lead_id = lid;

  const assignee = args.client.assigned_to?.trim();
  if (assignee) row.assigned_to = assignee;

  const compliance = args.client.assigned_compliance_id?.trim();
  if (compliance) row.assigned_compliance_id = compliance;

  let clientId: string;

  if (sid) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("shape_contact_id", sid)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from("clients").update(row).eq("id", existing.id as string);
      if (error) {
        return { ok: false, error: error.message, step: "client" };
      }
      clientId = existing.id as string;
    } else {
      const { data, error } = await supabase.from("clients").insert(row).select("id").single();
      if (error || !data?.id) {
        return {
          ok: false,
          error: error?.message ?? "Client insert returned no id",
          step: "client",
        };
      }
      clientId = data.id as string;
    }
  } else {
    const { data, error } = await supabase.from("clients").insert(row).select("id").single();

    if (error || !data?.id) {
      return {
        ok: false,
        error: error?.message ?? "Client insert returned no id",
        step: "client",
      };
    }
    clientId = data.id as string;
  }

  let noteId: string | null = null;

  if (args.note && args.note.body.trim()) {
    const sentAt = args.note.sent_at?.trim() || new Date().toISOString();
    const commRow: Record<string, unknown> = {
      client_id: clientId,
      type: "note",
      direction: "internal",
      subject: null,
      body: args.note.body.trim(),
      duration_seconds: null,
      recorded_by: args.note.recorded_by?.trim() || null,
      sent_at: sentAt,
    };

    const snid = args.note.shape_note_id?.trim();
    if (snid) commRow.shape_note_id = snid;

    if (snid) {
      const { data, error } = await supabase
        .from("communications")
        .upsert(commRow, { onConflict: "shape_note_id" })
        .select("id")
        .single();

      if (error || !data?.id) {
        return {
          ok: false,
          error: error?.message ?? "Note upsert failed",
          step: "note",
        };
      }
      noteId = data.id as string;
    } else {
      const { data, error } = await supabase
        .from("communications")
        .insert(commRow)
        .select("id")
        .single();

      if (error || !data?.id) {
        return {
          ok: false,
          error: error?.message ?? "Note insert failed",
          step: "note",
        };
      }
      noteId = data.id as string;
    }
  }

  let appointmentId: string | null = null;

  if (args.appointment && args.appointment.description.trim()) {
    const pt = args.appointment.pipeline_type;
    const reminderRow = buildReminderInsertRow({
      client_id: clientId,
      description: args.appointment.description.trim(),
      due_date: args.appointment.due_date?.trim() || null,
      assigned_to: args.appointment.assigned_to?.trim() || null,
      created_by: args.appointment.created_by?.trim() || null,
      client_stage: args.client.stage ?? "lead",
      appointment_type: args.appointment.appointment_type?.trim() || null,
      pipeline_type: pt === "sales" || pt === "service" ? pt : null,
      workflow_source: "migration",
    });

    const { data, error } = await supabase
      .from("reminders")
      .insert(reminderRow)
      .select("id")
      .single();

    if (error || !data?.id) {
      return {
        ok: false,
        error: error?.message ?? "Appointment (reminder) insert failed",
        step: "appointment",
      };
    }
    appointmentId = data.id as string;
  }

  return { ok: true, clientId, noteId, appointmentId };
}
