"use client";

import { useEffect } from "react";

/** One-time browser Notification permission prompt on CRM dashboard visit. */
export function DashboardNotificationPermission() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  return null;
}
