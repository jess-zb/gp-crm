"use client";

import { ToastProvider } from "@/app/components/Toast";

export function CrmProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
