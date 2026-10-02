"use client";

import { useEffect, useState } from "react";
import { formatDateTimeLong, getNextFedexBatchDeadline } from "@/lib/utils/date";

export function NextBatchCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  const [nextDate, setNextDate] = useState("");

  useEffect(() => {
    const update = () => {
      const next = getNextFedexBatchDeadline(new Date());
      const diff = next.getTime() - Date.now();

      setNextDate(formatDateTimeLong(next));

      if (diff <= 0) {
        setTimeLeft("Sending now...");
        return;
      }

      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      const secs = Math.floor((diff % 60_000) / 1000);

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0) parts.push(`${mins}m`);
      parts.push(`${String(secs).padStart(2, "0")}s`);
      setTimeLeft(parts.join(" "));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-green-800 dark:text-emerald-200">
            📦 Next Batch Deadline
          </p>
          <p className="mt-0.5 text-xs text-green-700 dark:text-emerald-300">{nextDate}</p>
          <p className="mt-1 text-xs text-green-600 dark:text-emerald-400/90">
            Batches send every Sunday & Wednesday at 8:00 PM Pacific
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="font-mono text-xl font-bold tabular-nums text-green-800 sm:text-2xl dark:text-emerald-200">
            {timeLeft}
          </p>
          <p className="text-xs text-green-600 dark:text-emerald-400">until cutoff</p>
        </div>
      </div>
    </div>
  );
}
