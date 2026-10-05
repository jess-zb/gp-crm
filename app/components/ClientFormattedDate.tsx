"use client";

import { useEffect, useState } from "react";
import {
  formatDate,
  formatDateTime,
  formatDateTimeAtWord,
  formatShortDateTime,
  formatShortMonthDayTime,
} from "@/lib/utils/date";

type Props = {
  iso: string | null | undefined;
  /** Legacy date-fns-style tokens; mapped to the Arizona office clock. */
  pattern?: string;
  fallback?: string;
  className?: string;
};

function formatIsoInLa(iso: string, pattern: string, fallback: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;

  switch (pattern) {
    case "MMM d, yyyy":
      return formatDate(d, { month: "short", day: "numeric", year: "numeric" });
    case "MMM d, h:mm a":
      return formatShortMonthDayTime(d);
    case "MMM d, yyyy 'at' h:mm a":
      return formatDateTimeAtWord(d);
    case "MM/dd/yy h:mm a":
      return formatShortDateTime(d);
    case "MMM d, yyyy, h:mm a":
    default:
      return formatDateTime(d);
  }
}

/**
 * Renders a formatted date only after mount so server HTML and the first
 * client render match (avoids hydration mismatches from locale/timezone).
 */
export function ClientFormattedDate({
  iso,
  pattern = "MMM d, yyyy, h:mm a",
  fallback = "—",
  className,
}: Props) {
  const [text, setText] = useState(fallback);

  useEffect(() => {
    if (iso == null || iso === "") {
      setText(fallback);
      return;
    }
    setText(formatIsoInLa(iso, pattern, fallback));
  }, [iso, pattern, fallback]);

  return <span className={className}>{text}</span>;
}
