"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MID_SELECT, type MidRow } from "@/lib/mids/queries";

/**
 * Active MIDs for any client-side picker. The `mids` table is the only source —
 * there is no hardcoded merchant list.
 */
export function useMids(): { mids: MidRow[]; loading: boolean } {
  const [mids, setMids] = useState<MidRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void supabase
      .from("mids")
      .select(MID_SELECT)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("[useMids]", error.message);
        else setMids((data ?? []) as MidRow[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => ({ mids, loading }), [mids, loading]);
}

/** Names only, for the e-sign review modal and other label-based pickers. */
export function useMidNames(): string[] {
  const { mids } = useMids();
  return useMemo(() => mids.map((m) => m.name), [mids]);
}
