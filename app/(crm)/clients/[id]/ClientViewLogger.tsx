"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function ClientViewLogger({
  clientId,
  userId,
  userName,
}: {
  clientId: string;
  userId: string;
  userName: string;
}) {
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    const supabase = createClient();
    void supabase.from("audit_log").insert({
      client_id: clientId,
      action: "client_record_viewed",
      new_value: { source: "crm" },
      performed_by: userId,
      performed_by_name: userName,
    });
  }, [clientId, userId, userName]);

  return null;
}
