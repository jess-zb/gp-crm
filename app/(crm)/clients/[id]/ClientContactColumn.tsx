"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { ModalOverlay } from "@/app/components/ModalOverlay";
import { ClientFormattedDate } from "@/app/components/ClientFormattedDate";
import { AccountTabForm, type AccountTabClient } from "./AccountTabForm";

function show(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function addressLine(client: AccountTabClient): string {
  const cityLine = [client.city, client.state, client.zip_code]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const parts = [client.street_address?.trim(), cityLine].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function ClientContactColumn({
  clientId,
  client,
  accountRevision,
  createdAt,
  updatedAt,
  clientRecordId,
}: {
  clientId: string;
  client: AccountTabClient;
  accountRevision: string;
  createdAt: string | null;
  updatedAt: string | null;
  clientRecordId: string;
}) {
  const [editing, setEditing] = useState(false);
  const rows: [string, string][] = [
    ["Verbal password", show(client.verbal_password)],
    ["Email", show(client.email)],
    ["Mobile", show(client.phone_mobile)],
    ["Work phone", show(client.phone_work)],
    ["Home phone", show(client.phone_home)],
    ["Address", addressLine(client)],
  ];

  return (
    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-[#2E2E2E]">
      <dl className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            {label === "Verbal password" ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {label}
                </dt>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#A87830] hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:hover:bg-[#2A2418]"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </button>
              </div>
            ) : (
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </dt>
            )}
            <dd className="break-words text-sm text-slate-800 dark:text-slate-100">{value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Created
          </dt>
          <dd className="text-sm text-slate-800 dark:text-slate-100">
            <ClientFormattedDate iso={createdAt} pattern="MMM d, yyyy, h:mm a" />
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Last activity
          </dt>
          <dd className="text-sm text-slate-800 dark:text-slate-100">
            <ClientFormattedDate iso={updatedAt} pattern="MMM d, yyyy, h:mm a" />
          </dd>
        </div>
      </dl>
      <p className="mt-4 break-all text-[11px] text-slate-400">Client ID: {clientRecordId}</p>

      {editing ? (
        <ModalOverlay labelledBy="edit-client-title" onBackdropClick={() => setEditing(false)}>
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC] dark:border-[#2E2E2E] dark:bg-[#121212]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
              <h2 id="edit-client-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Edit client
              </h2>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A87830] dark:hover:bg-[#242424]"
                aria-label="Close edit client"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <AccountTabForm
                clientId={clientId}
                client={client}
                accountRevision={accountRevision}
              />
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
