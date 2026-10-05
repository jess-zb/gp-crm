"use client";

import { useEffect, useState } from "react";
import { timeZoneForClient } from "@/lib/time/client-timezone";
import { OFFICE_TIME_LABEL, OFFICE_TZ } from "@/lib/time/office";
import { formatZonedClock, formatZonedDateTime, wallTimeToUtc } from "@/lib/time/zoned";

function useLocalTimeZone(): string | null {
  const [timeZone, setTimeZone] = useState<string | null>(null);
  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  return timeZone;
}

/** The clock used when booking: the client's zone, or Arizona when the state is missing. */
export function bookingTimeZone(state?: string | null, zip?: string | null): {
  timeZone: string;
  label: string;
} {
  return timeZoneForClient(state, zip) ?? { timeZone: OFFICE_TZ, label: OFFICE_TIME_LABEL };
}

export function appointmentInstantFromClientTime(
  date: string,
  time: string,
  state?: string | null,
  zip?: string | null
): Date | null {
  return wallTimeToUtc(date, time.trim() || "09:00", bookingTimeZone(state, zip).timeZone);
}

function ClockLines({
  instant,
  state,
  zip,
  withDate,
  localTimeZone,
}: {
  instant: Date;
  state?: string | null;
  zip?: string | null;
  withDate: boolean;
  localTimeZone: string | null;
}) {
  const client = timeZoneForClient(state, zip);
  const format = withDate ? formatZonedDateTime : formatZonedClock;
  const clientText = client ? format(instant, client.timeZone) : "Add a state on the client";
  const arizonaText = format(instant, OFFICE_TZ);
  const yourText = localTimeZone ? format(instant, localTimeZone) : null;

  return (
    <span className="block min-w-0 text-xs font-normal leading-5 text-slate-600 dark:text-slate-300">
      <span className="block">
        <span className="text-slate-400 dark:text-slate-500">Client </span>
        {clientText}
      </span>
      <span className="block">
        <span className="text-slate-400 dark:text-slate-500">Arizona </span>
        {arizonaText}
      </span>
      {yourText ? (
        <span className="block">
          <span className="text-slate-400 dark:text-slate-500">Your time </span>
          {yourText}
        </span>
      ) : null}
    </span>
  );
}

/** Live readout while the date and time are entered in the client's zone. */
export function AppointmentClockPreview({
  date,
  time,
  state,
  zip,
}: {
  date: string;
  time: string;
  state?: string | null;
  zip?: string | null;
}) {
  const localTimeZone = useLocalTimeZone();
  if (!date.trim()) return null;
  const instant = appointmentInstantFromClientTime(date, time, state, zip);
  if (!instant) return null;
  return (
    <ClockLines
      instant={instant}
      state={state}
      zip={zip}
      withDate={false}
      localTimeZone={localTimeZone}
    />
  );
}

/** Saved appointment: client time, Arizona time, and the viewer's own clock. */
export function AppointmentWhen({
  iso,
  state,
  zip,
  withDate = true,
}: {
  iso: string | null | undefined;
  state?: string | null;
  zip?: string | null;
  withDate?: boolean;
}) {
  const localTimeZone = useLocalTimeZone();
  if (!iso) return <>—</>;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return <>—</>;
  return (
    <ClockLines
      instant={instant}
      state={state}
      zip={zip}
      withDate={withDate}
      localTimeZone={localTimeZone}
    />
  );
}
