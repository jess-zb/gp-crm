"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function ClientBackButton() {
  const [backUrl, setBackUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = sessionStorage.getItem("clientListUrl");
    if (url) setBackUrl(url);
  }, []);

  if (!backUrl) return null;

  return (
    <Link
      href={backUrl}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Clients
    </Link>
  );
}
