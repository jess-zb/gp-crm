"use client";

import { useEffect, useState } from "react";
import { OFFICE_TZ } from "@/lib/time/office";

function arizonaTimeLabel(now: Date): string {
  return now.toLocaleTimeString("en-US", {
    timeZone: OFFICE_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Live office clock, kept with the search and chat buttons. */
export function ArizonaClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(arizonaTimeLabel(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="flex h-11 min-w-[5.5rem] flex-col items-center justify-center rounded-full border border-slate-200 bg-white px-3 shadow-sm dark:border-[#2E2E2E] dark:bg-[#1C1C1C]"
      aria-label="Current Arizona time"
      title="Current Arizona time"
    >
      <span className="text-sm font-semibold tabular-nums leading-none text-slate-800 dark:text-slate-100">
        {time ?? "—"}
      </span>
      <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide leading-none text-slate-400">
        Arizona
      </span>
    </div>
  );
}
