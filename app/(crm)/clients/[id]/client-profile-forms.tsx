"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { toUserFacingError } from "@/lib/user-facing-error";
import { addClientCard, createClientReminder } from "./actions";

export function ReminderForm({ clientId }: { clientId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await createClientReminder(fd);
      if (r.ok) {
        toast.success("Appointment saved");
        e.currentTarget.reset();
      } else {
        toast.error(toUserFacingError(r.error));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <label className="block text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          Appointment
        </span>
        <input
          name="reminder_description"
          required
          className="crm-input mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          Due date
        </span>
        <input
          type="date"
          name="reminder_due_date"
          className="crm-input mt-1 w-full"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="crm-btn-primary flex w-full items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

export function AddCardForm({ clientId }: { clientId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await addClientCard(fd);
      if (r.ok) {
        toast.success("Card saved");
        e.currentTarget.reset();
      } else {
        toast.error(toUserFacingError(r.error));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-lg border border-slate-100 p-4 dark:border-[#2E2E2E] sm:grid-cols-2"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <label className="block text-sm sm:col-span-2">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          Creditor name
        </span>
        <input
          name="creditor_name"
          required
          className="crm-input mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          Card type
        </span>
        <select
          name="card_type"
          className="crm-input mt-1 w-full"
        >
          <option value="visa">Visa</option>
          <option value="mastercard">Mastercard</option>
          <option value="amex">Amex</option>
          <option value="discover">Discover</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          Last four
        </span>
        <input
          name="last_four"
          required
          maxLength={4}
          pattern="[0-9]{4}"
          className="crm-input mt-1 w-full font-mono"
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="crm-btn-primary flex items-center gap-2 px-4 py-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Saving card..." : "Save card"}
        </button>
      </div>
    </form>
  );
}
