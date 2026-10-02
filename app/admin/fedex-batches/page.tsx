import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileForUser } from "@/lib/supabase/profile";
import {
  canAccessFedExBatches,
  canEditPacketMid,
  canExportPacketsNeeded,
  canExportPacketsNeededCsv,
  isDev as isDevRole,
} from "@/lib/roles";

const DEV_EMAIL = "dev@debtsupportpros.com";
import {
  fetchPacketManagerData,
  fetchPacketsNeeded,
} from "@/lib/packets/fetch-packet-manager-data";
import { PacketManagerLayout } from "./PacketManagerLayout";

export default async function FedexBatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getProfileForUser(supabase, user);
  if (!profile) redirect("/login");
  if (profile.role === "client") redirect("/portal");
  if (!canAccessFedExBatches(profile.role)) redirect("/dashboard");

  const isAdmin = ["admin", "dev"].includes(profile.role ?? "");
  const isDev = user.email === DEV_EMAIL;
  const canManualSend = isDevRole(profile.role);
  const canExport = canExportPacketsNeeded(profile.role, user.email);
  const canExportCsv = canExportPacketsNeededCsv(profile.role, user.email);
  const canEditMid = canEditPacketMid(profile.role);

  const {
    packetsSent,
    packetsDelivered,
    archiveShipments,
    latestBatch,
    secondBatch,
  } = await fetchPacketManagerData();

  const { rows: packetsNeeded, error: neededError } = await fetchPacketsNeeded();
  if (neededError) {
    console.error("[PacketManager] packets needed error:", neededError);
  }

  return (
    <main className="mx-auto min-w-0 max-w-6xl overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="crm-page-title mb-6 text-2xl font-bold text-slate-900 dark:text-white">
        Packet Manager
      </h1>

      <PacketManagerLayout
        isAdmin={isAdmin}
        isDev={isDev}
        canExport={canExport}
        canExportCsv={canExportCsv}
        canEditMid={canEditMid}
        canManualSend={canManualSend}
        packetsNeeded={packetsNeeded}
        packetsSent={packetsSent}
        packetsDelivered={packetsDelivered}
        archiveShipments={archiveShipments}
        latestBatch={latestBatch}
        secondBatch={secondBatch}
      />
    </main>
  );
}
