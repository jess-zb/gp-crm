"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { isHiddenFromRole } from "@/lib/constants/hidden-accounts";
import { getRoleDisplayName } from "@/lib/utils/roles";
import { isDevOrAdmin } from "@/lib/roles";
import { normalizePipelineStage } from "@/lib/clients/pipeline-status";
import {
  filterByDepartment,
  type DepartmentMemberOption,
} from "@/lib/team/department-members";
import { staffNameWithDirectLine } from "@/lib/team/direct-line";
import { updateClientSettings } from "./actions";
import { SettingsMenuSelect } from "./SettingsMenuSelect";

export type ClientSettingsTabClient = {
  stage: string | null;
  assigned_to: string | null;
  assigned_services_id: string | null;
  attorney_id: string | null;
  attorney: { full_name: string | null; email: string | null } | null;
  is_active: boolean | null;
};

type StaffOption = DepartmentMemberOption;

type AttorneyOption = StaffOption & {
  is_default_attorney?: boolean | null;
};

function staffLabel(person: {
  id: string;
  full_name?: string | null;
  email?: string | null;
  direct_line?: string | null;
}): string {
  return staffNameWithDirectLine(
    person.full_name,
    person.direct_line,
    person.email?.trim() || person.id.slice(0, 8)
  );
}

function ReadOnlySetting({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="w-full max-w-xs text-sm">
      <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-800 dark:border-[#3A3A3A] dark:bg-[#121212] dark:text-slate-200">
        {value}
        {detail ? (
          <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">{detail}</span>
        ) : null}
      </p>
    </div>
  );
}

export function ClientSettingsTab({
  clientId,
  client,
  canReassignClient,
  canViewAssignedAttorneyField,
  viewerRole,
  userRole,
  staffOptions,
  attorneyOptions,
  assigneeName,
  assigneeRole,
  assigneeDirectLine = null,
  servicesAssigneeName,
  servicesAssigneeDirectLine = null,
}: {
  clientId: string;
  client: ClientSettingsTabClient;
  canReassignClient: boolean;
  canViewAssignedAttorneyField: boolean;
  viewerRole: string;
  /** Same as viewer profile role; used to gate attorney dropdown (dev/admin only). */
  userRole: string;
  staffOptions: StaffOption[];
  attorneyOptions: AttorneyOption[];
  assigneeName: string | null;
  assigneeRole?: string | null;
  assigneeDirectLine?: string | null;
  servicesAssigneeName?: string | null;
  servicesAssigneeDirectLine?: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [recordActive, setRecordActive] = useState(client.is_active !== false);
  const toggleBusyRef = useRef(false);

  const initialStage = normalizePipelineStage(client.stage);

  useEffect(() => {
    setRecordActive(client.is_active !== false);
  }, [client.is_active]);

  const visibleStaff = staffOptions.filter(
    (s) =>
      !isHiddenFromRole(s.email, viewerRole) ||
      (client.assigned_to && s.id === client.assigned_to) ||
      (client.assigned_services_id && s.id === client.assigned_services_id)
  );
  const accountsOptions = filterByDepartment(
    visibleStaff,
    "is_accounts",
    client.assigned_to
  );
  const servicesOptions = filterByDepartment(
    visibleStaff,
    "is_services",
    client.assigned_services_id
  );

  const handleToggleActive = useCallback(async () => {
    if (toggleBusyRef.current) return;
    toggleBusyRef.current = true;
    try {
      const supabase = createClient();
      const next = !recordActive;
      const { error } = await supabase
        .from("clients")
        .update({ is_active: next })
        .eq("id", clientId);
      if (error) throw error;
      setRecordActive(next);
      toast.success(next ? "Record marked active" : "Record archived");
      router.refresh();
    } catch (e) {
      toast.error(toUserFacingError(e instanceof Error ? e.message : "Update failed"));
    } finally {
      toggleBusyRef.current = false;
    }
  }, [clientId, recordActive, router, toast]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    setIsSaving(true);
    try {
      const res = await updateClientSettings(fd);
      if (!res || !res.ok) {
        toast.error(toUserFacingError(res?.error ?? "An unexpected error occurred. Please refresh the page."));
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error("An unexpected error occurred. Please refresh the page.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
      <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Client settings</h3>
      <form onSubmit={onSubmit} className="space-y-6">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="stage" value={initialStage} />

        <div className="flex flex-col gap-5">
          {canReassignClient ? (
            <SettingsMenuSelect
              name="assigned_to"
              label="Accounts"
              defaultValue={client.assigned_to ?? ""}
              emptyLabel="Unassigned"
              options={accountsOptions.map((person) => ({
                value: person.id,
                label: staffLabel(person),
              }))}
            />
          ) : (
            <ReadOnlySetting
              label="Accounts"
              value={assigneeName ?? "—"}
              detail={
                [
                  assigneeName && assigneeRole ? getRoleDisplayName(assigneeRole) : null,
                  assigneeDirectLine?.trim() || null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null
              }
            />
          )}
          {canReassignClient ? (
            <SettingsMenuSelect
              name="assigned_services_id"
              label="Client Services"
              defaultValue={client.assigned_services_id ?? ""}
              emptyLabel="Unassigned"
              options={servicesOptions.map((person) => ({
                value: person.id,
                label: staffLabel(person),
              }))}
            />
          ) : (
            <ReadOnlySetting
              label="Client Services"
              value={servicesAssigneeName ?? "—"}
              detail={servicesAssigneeDirectLine?.trim() || null}
            />
          )}

          {canViewAssignedAttorneyField ? (
            isDevOrAdmin(userRole) ? (
              <SettingsMenuSelect
                name="attorney_id"
                label="Assigned Attorney"
                defaultValue={client.attorney_id ?? ""}
                emptyLabel="No attorney assigned"
                options={attorneyOptions.map((attorney) => ({
                  value: attorney.id,
                  label: `${attorney.full_name?.trim() || attorney.id.slice(0, 8)}${
                    attorney.is_default_attorney ? " (Default)" : ""
                  }`,
                }))}
              />
            ) : (
              <ReadOnlySetting
                label="Assigned Attorney"
                value={
                  client.attorney_id
                    ? client.attorney?.full_name?.trim() ||
                      client.attorney?.email?.trim() ||
                      attorneyOptions.find((attorney) => attorney.id === client.attorney_id)?.full_name?.trim() ||
                      "—"
                    : "—"
                }
              />
            )
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-[#2E2E2E]">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-slate-400">Record Status</span>
            <button
              type="button"
              onClick={() => void handleToggleActive()}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                recordActive ? "bg-[#A87830]" : "bg-gray-300 dark:bg-slate-600"
              }`}
              aria-pressed={recordActive}
              aria-label={recordActive ? "Mark archived" : "Mark active"}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  recordActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium ${
                recordActive ? "text-[#A87830] dark:text-[#A87830]" : "text-gray-400 dark:text-slate-500"
              }`}
            >
              {recordActive ? "Active" : "Archived"}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-[#A87830] px-5 py-2.5 text-sm font-medium text-[#161616] transition-colors hover:bg-[#8C6428] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>

    </section>
  );
}
