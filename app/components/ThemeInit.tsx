"use client";

import { useEffect } from "react";

const STORAGE_KEY = "zb-theme";

export function ThemeInit() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      // localStorage unavailable
    }
  }, []);
  return null;
}
