"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  mergeMerchantOptions,
  PACKET_MID_EXTRAS_SETTING_KEY,
  parsePacketMidExtras,
} from "@/lib/constants/merchants";

/**
 * Sorted merchant/MID options for CRM pickers (built-ins + crm_settings extras).
 * Same source as Packet Manager Dev "MID options" adds.
 */
export function useMerchantOptions(): string[] {
  const [extras, setExtras] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("crm_settings")
      .select("value")
      .eq("key", PACKET_MID_EXTRAS_SETTING_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("[useMerchantOptions] load error:", error.message);
          return;
        }
        setExtras(parsePacketMidExtras(data?.value));
      });
  }, []);

  return useMemo(() => mergeMerchantOptions(extras), [extras]);
}
