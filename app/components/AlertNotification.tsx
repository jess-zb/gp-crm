"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, Calendar } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

// Unread chat is surfaced by the ChatWidget badge only; it must never take
// over the screen the way appointment alerts intentionally do.
type AlertType =
  | "appointment_upcoming"
  | "appointment_missed"
  | "overdue_task";

interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  clientName?: string;
  clientId?: string;
  actionLabel?: string;
  actionUrl?: string;
}

const ALERT_ICONS = {
  appointment_upcoming: Calendar,
  appointment_missed: AlertTriangle,
  overdue_task: AlertTriangle,
} as const;

const ALERT_COLORS = {
  appointment_upcoming: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    icon: "text-blue-600 dark:text-blue-400",
    btn: "bg-blue-600 hover:bg-blue-700",
  },
  appointment_missed: {
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
    icon: "text-red-600 dark:text-red-400",
    btn: "bg-red-600 hover:bg-red-700",
  },
  overdue_task: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    icon: "text-amber-600 dark:text-amber-400",
    btn: "bg-amber-600 hover:bg-amber-700",
  },
} as const;

type ReminderClient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function parseReminderClient(
  raw: ReminderClient | ReminderClient[] | null | undefined
): ReminderClient | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function clientDisplayName(client: ReminderClient | null): string | undefined {
  if (!client) return undefined;
  const name =
    `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
  return name || undefined;
}

export function AlertNotification({ userId }: { userId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const supabase = createClient();
  const shownSourceKeysRef = useRef<Set<string>>(new Set());

  const addAlert = useCallback(
    (alert: Omit<Alert, "id">, sourceKey: string) => {
      if (shownSourceKeysRef.current.has(sourceKey)) return;
      shownSourceKeysRef.current.add(sourceKey);
      const id = crypto.randomUUID();
      setAlerts((prev) => [...prev, { ...alert, id }]);
    },
    []
  );

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    const checkAppointments = async () => {
      const now = new Date();
      const in5min = new Date(now.getTime() + 5 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const { data: upcoming } = await supabase
        .from("reminders")
        .select(
          `
          id, description, due_date, appointment_type,
          client:client_id(id, first_name, last_name)
        `
        )
        .eq("assigned_to", userId)
        .eq("completed", false)
        .eq("cancelled", false)
        .gte("due_date", now.toISOString())
        .lte("due_date", in5min.toISOString());

      upcoming?.forEach((appt) => {
        const sourceKey = `upcoming:${appt.id}`;
        if (shownSourceKeysRef.current.has(sourceKey)) return;

        const client = parseReminderClient(
          appt.client as ReminderClient | ReminderClient[] | null
        );
        addAlert(
          {
            type: "appointment_upcoming",
            title: "Appointment in 5 minutes",
            message:
              (appt.description as string | null)?.trim() ||
              (appt.appointment_type as string | null)?.trim() ||
              "Upcoming appointment",
            clientName: clientDisplayName(client),
            clientId: client?.id,
            actionLabel: "View Client",
            actionUrl: client?.id ? `/clients/${client.id}` : undefined,
          },
          sourceKey
        );
      });

      const { data: missed } = await supabase
        .from("reminders")
        .select(
          `
          id, description, due_date, appointment_type,
          client:client_id(id, first_name, last_name)
        `
        )
        .eq("assigned_to", userId)
        .eq("completed", false)
        .eq("cancelled", false)
        .lt("due_date", now.toISOString())
        .gte("due_date", oneHourAgo.toISOString());

      missed?.slice(0, 3).forEach((appt) => {
        const sourceKey = `missed:${appt.id}`;
        if (shownSourceKeysRef.current.has(sourceKey)) return;

        const client = parseReminderClient(
          appt.client as ReminderClient | ReminderClient[] | null
        );
        addAlert(
          {
            type: "appointment_missed",
            title: "Missed Appointment",
            message:
              (appt.description as string | null)?.trim() ||
              (appt.appointment_type as string | null)?.trim() ||
              "Past due appointment",
            clientName: clientDisplayName(client),
            clientId: client?.id,
            actionLabel: "View Client",
            actionUrl: client?.id ? `/clients/${client.id}` : undefined,
          },
          sourceKey
        );
      });
    };

    void checkAppointments();
    const interval = setInterval(() => void checkAppointments(), 60_000);
    return () => clearInterval(interval);
  }, [userId, supabase, addAlert]);

  useEffect(() => {
    if (alerts.length === 0) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [alerts.length]);

  const currentAlert = alerts[0];
  const colors = currentAlert ? ALERT_COLORS[currentAlert.type] : null;
  const Icon = currentAlert ? ALERT_ICONS[currentAlert.type] : null;

  return (
    <AnimatePresence>
      {currentAlert && colors && Icon ? (
        <motion.div
          key={currentAlert.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="alert-notification-title"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", bounce: 0.3 }}
            className={`mx-4 w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${colors.bg} ${colors.border}`}
            onClick={(e) => e.stopPropagation()}
          >
            {alerts.length > 1 ? (
              <div className="mb-2 flex justify-end">
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-white dark:bg-slate-600">
                  {alerts.length} alerts
                </span>
              </div>
            ) : null}

            <div className="mb-4 flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-[#1C1C1C]">
                <Icon className={`h-6 w-6 ${colors.icon}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  id="alert-notification-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  {currentAlert.title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {currentAlert.message}
                </p>
                {currentAlert.clientName ? (
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Client: {currentAlert.clientName}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex gap-3">
              {currentAlert.actionUrl ? (
                <Link
                  href={currentAlert.actionUrl}
                  onClick={() => dismissAlert(currentAlert.id)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white transition-opacity hover:opacity-90 ${colors.btn}`}
                >
                  {currentAlert.actionLabel ?? "View"}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => dismissAlert(currentAlert.id)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#2E2E2E] dark:bg-[#121212] dark:text-slate-200 dark:hover:bg-[#242424]"
              >
                {alerts.length > 1
                  ? `OK (${alerts.length - 1} more)`
                  : "OK, Got It"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
