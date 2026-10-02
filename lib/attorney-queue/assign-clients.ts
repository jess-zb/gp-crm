import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAttorneyPortalAssignmentVariables,
  sendStaffEmailNowWithQueueFallback,
} from "@/lib/email/dispatch-staff-emails";
import { ensureCaseReferredOnAssign } from "@/lib/email/ensure-case-referred-on-assign";
import { isDeliverableEmail } from "@/lib/email/is-deliverable-email";
import { appBaseUrl } from "@/lib/attorney-queue/tokens";
import { createServiceClient } from "@/lib/supabase/server";

export type AssignClientsToAttorneyResult =
  | {
      ok: true;
      clientCount: number;
      attorneyId: string;
      attorneyName: string;
      clientEmailWarnings: string[];
    }
  | { ok: false; error: string };

/**
 * Bulk-assign queue clients to an attorney for portal access.
 * Sets attorney_id, stamps assignment metadata, enrolls case_referred (instant
 * send with cron backup), sends attorney assignment email (instant with cron
 * backup), and in-app notifications.
 */
export async function assignClientsToAttorney(args: {
  supabase: SupabaseClient;
  clientIds: string[];
  attorneyId: string;
  assignedBy: string;
  assignedByName: string;
}): Promise<AssignClientsToAttorneyResult> {
  const clientIds = Array.from(
    new Set(args.clientIds.map((id) => id.trim()).filter(Boolean))
  );
  const attorneyId = args.attorneyId.trim();

  if (clientIds.length === 0) {
    return { ok: false, error: "Select at least one client." };
  }
  if (!attorneyId) {
    return { ok: false, error: "Select an attorney." };
  }

  const { data: attorney, error: attyErr } = await args.supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("id", attorneyId)
    .maybeSingle();

  if (attyErr) {
    return { ok: false, error: attyErr.message };
  }
  if (!attorney || attorney.role !== "attorney") {
    return { ok: false, error: "Invalid attorney selection." };
  }
  if (attorney.is_active === false) {
    return { ok: false, error: "Selected attorney is inactive." };
  }

  const attorneyEmail = (attorney.email as string | null)?.trim() || null;
  if (!isDeliverableEmail(attorneyEmail)) {
    return {
      ok: false,
      error: "Selected attorney does not have a valid email on file.",
    };
  }

  const attorneyName =
    (attorney.full_name as string | null)?.trim() || attorneyEmail || "Attorney";

  const { data: clients, error: clientErr } = await args.supabase
    .from("clients")
    .select(
      "id, stage, attorney_portal_assigned_at, first_name, last_name, email"
    )
    .in("id", clientIds);

  if (clientErr) {
    return { ok: false, error: clientErr.message };
  }

  const clientById = new Map((clients ?? []).map((c) => [c.id as string, c]));
  for (const id of clientIds) {
    const row = clientById.get(id);
    if (!row) return { ok: false, error: `Client not found: ${id}` };
    if (row.stage !== "case_sent_to_attorneys") {
      return {
        ok: false,
        error: "Only clients in Case Sent to Attorneys can be assigned.",
      };
    }
    if (row.attorney_portal_assigned_at) {
      return {
        ok: false,
        error: "One or more selected clients are already assigned to an attorney.",
      };
    }
    if (!isDeliverableEmail(row.email as string | null)) {
      const name =
        `${(row.first_name as string | null) ?? ""} ${(row.last_name as string | null) ?? ""}`.trim() ||
        "Client";
      return {
        ok: false,
        error: `${name} does not have a valid email on file. Add an email before assigning to an attorney.`,
      };
    }
  }

  const now = new Date().toISOString();
  const service = createServiceClient();

  const { data: updatedRows, error: updateErr } = await service
    .from("clients")
    .update({
      attorney_id: attorneyId,
      attorney_portal_assigned_at: now,
      attorney_portal_assigned_by: args.assignedBy,
    })
    .in("id", clientIds)
    .eq("stage", "case_sent_to_attorneys")
    .is("attorney_portal_assigned_at", null)
    .select("id");

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  const assignedIds = (updatedRows ?? []).map((row) => row.id as string);
  if (assignedIds.length !== clientIds.length) {
    return {
      ok: false,
      error: "Some clients could not be assigned. Refresh the queue and try again.",
    };
  }

  const clientSummaries: { id: string; name: string }[] = [];
  const clientEmailWarnings: string[] = [];

  for (const clientId of assignedIds) {
    const client = clientById.get(clientId)!;
    const clientName =
      `${(client.first_name as string | null) ?? ""} ${(client.last_name as string | null) ?? ""}`.trim() ||
      "Client";
    clientSummaries.push({ id: clientId, name: clientName });

    const caseReferred = await ensureCaseReferredOnAssign(service, {
      clientId,
      clientEmail: client.email as string | null,
    });
    if (!caseReferred.ok) {
      clientEmailWarnings.push(
        `${clientName}: case referred email could not be enrolled (${caseReferred.reason}).`
      );
      console.warn(
        "[attorney-queue] case_referred:",
        clientId,
        caseReferred.reason
      );
    } else if (caseReferred.mode === "already_completed") {
      clientEmailWarnings.push(
        `${clientName}: case referred email was already sent previously.`
      );
    } else if (!caseReferred.sentNow) {
      clientEmailWarnings.push(
        `${clientName}: case referred email queued for cron retry.`
      );
    }

    const { error: auditErr } = await service.from("audit_log").insert({
      client_id: clientId,
      action: "attorney_portal_assigned",
      old_value: { attorney_id: null, attorney_portal_assigned_at: null },
      new_value: {
        attorney_id: attorneyId,
        attorney_portal_assigned_at: now,
        attorney_name: attorneyName,
      },
      performed_by: args.assignedBy,
      performed_by_name: args.assignedByName,
    });
    if (auditErr) {
      console.warn("[attorney-queue] audit log:", auditErr.message);
    }
  }

  const casesUrl = `${appBaseUrl()}/attorney/cases`;

  const attorneyEmailResult = await sendStaffEmailNowWithQueueFallback(service, {
    templateKey: "attorney_portal_assignment",
    toEmail: attorneyEmail,
    recipientUserId: attorneyId,
    variables: buildAttorneyPortalAssignmentVariables({
      attorneyName,
      clientSummaries,
      casesUrl,
    }),
  });
  if (!attorneyEmailResult.ok) {
    console.warn("[attorney-queue] attorney email:", attorneyEmailResult.error);
    clientEmailWarnings.push(
      `Attorney email failed: ${attorneyEmailResult.error}`
    );
  } else if (attorneyEmailResult.mode === "queued_for_cron") {
    clientEmailWarnings.push(
      "Attorney email queued for cron retry (instant send unavailable)."
    );
  }

  const { error: notifErr } = await service.from("notifications").insert(
    clientSummaries.map((c) => ({
      user_id: attorneyId,
      type: "attorney_portal_assignment",
      title: "New case assigned",
      body: `${c.name} has been assigned to you. Open the case file in your portal.`,
      client_id: c.id,
      client_name: c.name,
      read: false,
      action_url: `/attorney/cases/${c.id}`,
    }))
  );
  if (notifErr) {
    console.warn("[attorney-queue] attorney notifications:", notifErr.message);
  }

  return {
    ok: true,
    clientCount: assignedIds.length,
    attorneyId,
    attorneyName,
    clientEmailWarnings,
  };
}
