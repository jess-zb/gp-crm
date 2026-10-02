"use client";

import { CommunicationsHub } from "./CommunicationsHub";
import { CrmPageHeader } from "@/app/components/CrmPageHeader";

export default function CommunicationsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmPageHeader title="Communications" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-5">
        <p className="text-[13px] text-slate-600 dark:text-slate-400">
          Team Chat, department channels, and client portal threads.
        </p>

        <div className="mt-4">
          <CommunicationsHub />
        </div>
      </main>
    </div>
  );
}
