import type { SupabaseClient } from "@supabase/supabase-js";

/** Jessica + Developer only — Packet Manager send/cron failures. */
export const PACKET_SEND_ALERT_EMAILS = [
  "jessica@debtsupportpros.com",
  "dev@debtsupportpros.com",
] as const;

/**
 * In-app bell for print-batch failures. Service role so the Developer
 * profile is reachable despite profiles RLS.
 */
export async function notifyPacketSendOps(
  admin: SupabaseClient,
  opts: { title: string; body: string }
): Promise<void> {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, email")
    .in("email", [...PACKET_SEND_ALERT_EMAILS]);

  if (error) {
    console.warn("[notifyPacketSendOps] profiles:", error.message);
    return;
  }

  const rows = (profiles ?? []).map((p) => ({
    user_id: p.id as string,
    type: "fedex_update",
    title: opts.title,
    body: opts.body,
    read: false,
    action_url: "/admin/fedex-batches",
  }));

  if (!rows.length) return;

  const { error: insErr } = await admin.from("notifications").insert(rows);
  if (insErr) {
    console.warn("[notifyPacketSendOps] insert:", insErr.message);
  }
}
