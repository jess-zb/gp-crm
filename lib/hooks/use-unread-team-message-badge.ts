"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Unread in-app notifications of type `team_message` (DM / dept pings).
 * Cleared when the user opens Communications from the sidebar.
 */
export function useUnreadTeamMessageBadge(userId: string | undefined) {
  const [unreadComms, setUnreadComms] = useState(0);

  const clearCommsBadge = useCallback(async () => {
    if (!userId) return;
    setUnreadComms(0);
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("type", "team_message")
      .eq("read", false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const countUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "team_message")
        .eq("read", false);
      setUnreadComms(count ?? 0);
    };

    void countUnread();

    const channel = supabase
      .channel(`comms-badge-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as { type?: string };
          if (n.type === "team_message") {
            setUnreadComms((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void countUnread();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { unreadComms, clearCommsBadge };
}
