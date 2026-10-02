import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { partitionPacketManagerTabs } from "../lib/packets/packet-manager-tabs";
import { shipmentPatchFromCarrierScan } from "../lib/postlogic/shipment-status-sync";
import { PACKET_SEND_ALERT_EMAILS } from "../lib/packets/notify-packet-send-ops";
import { mapPostlogicStatusToLabel } from "../lib/postlogic/fedex-print-status";
import { isUndefinedColumnError } from "../lib/packets/carrier-status-column";
import { isFedexPrintBatchEnabled } from "../lib/packets/print-batch-setting";
import { shouldPreserveExistingPrintBatchRun } from "../lib/packets/print-batch-runs";

console.log("Packet Manager tab + sync invariants\n");

const mixed = [
  { batch_id: "2026-08-23", status: "Processing" },
  { batch_id: "2026-08-19", status: "Delivered" },
  { batch_id: "2026-08-19", status: "Delivered" },
  { batch_id: "2026-08-23", status: "Delivered" },
  { batch_id: "2026-08-16", status: "Archived" },
];

const tabs = partitionPacketManagerTabs(mixed);
assert.equal(tabs.latestBatch, "2026-08-23");
assert.equal(tabs.packetsSent.length, 1);
assert.equal(tabs.packetsSent[0]?.batch_id, "2026-08-23");
assert.ok(
  tabs.packetsDelivered.filter((s) => s.batch_id === "2026-08-19").length === 2,
  "previous cycle stays on Delivered tab"
);
assert.ok(!tabs.packetsSent.some((s) => s.batch_id === "2026-08-19"));
assert.equal(tabs.archiveShipments.length, 1);
console.log("  ✓ tabs follow status only (Processing / Delivered / Archived)");

const leftoverScanAsTab = partitionPacketManagerTabs([
  { batch_id: "2026-08-23", status: "Processing" },
  { batch_id: "2026-08-19", status: "In Transit" },
]);
assert.equal(leftoverScanAsTab.packetsSent.length, 1);
assert.ok(
  leftoverScanAsTab.archiveShipments.some((s) => s.status === "In Transit"),
  "scan words are not a Sent tab"
);
console.log("  ✓ leftover In Transit status cannot occupy Packets Sent");

assert.deepEqual(
  shipmentPatchFromCarrierScan({
    tabStatus: "Delivered",
    carrierStatus: "Delivered",
    incoming: "In Transit",
  }),
  { carrier_status: "In Transit" },
  "In Transit updates the badge only"
);
assert.equal(
  shipmentPatchFromCarrierScan({
    tabStatus: "Delivered",
    carrierStatus: "In Transit",
    incoming: "In Transit",
  })?.status,
  undefined,
  "must not move a Delivered tab backward"
);
assert.equal(
  shipmentPatchFromCarrierScan({
    tabStatus: "Archived",
    carrierStatus: "In Transit",
    incoming: "In Transit",
  }),
  null
);
assert.deepEqual(
  shipmentPatchFromCarrierScan({
    tabStatus: "Archived",
    carrierStatus: "Delivered",
    incoming: "In Transit",
  }),
  { carrier_status: "In Transit" }
);
assert.equal(
  shipmentPatchFromCarrierScan({
    tabStatus: "Archived",
    carrierStatus: "Delivered",
    incoming: "In Transit",
  })?.status,
  undefined
);
assert.deepEqual(
  shipmentPatchFromCarrierScan({
    tabStatus: "Processing",
    carrierStatus: "Processing",
    incoming: "In Transit",
  }),
  { carrier_status: "In Transit" }
);
assert.deepEqual(
  shipmentPatchFromCarrierScan({
    tabStatus: "Processing",
    carrierStatus: "In Transit",
    incoming: "Delivered",
  }),
  { carrier_status: "Delivered", status: "Delivered" }
);
assert.deepEqual(
  shipmentPatchFromCarrierScan({
    tabStatus: "Delivered",
    carrierStatus: "In Transit",
    incoming: "Delivered",
  }),
  { carrier_status: "Delivered" }
);
assert.deepEqual(
  shipmentPatchFromCarrierScan({
    tabStatus: "Processing",
    carrierStatus: "Processing",
    incoming: "Production",
  }),
  { carrier_status: "Production" }
);
console.log("  ✓ In Transit cannot move a Delivered/Archived tab backward");

assert.deepEqual(
  [...PACKET_SEND_ALERT_EMAILS].sort(),
  ["dev@debtsupportpros.com", "jessica@debtsupportpros.com"].sort()
);
assert.equal(isFedexPrintBatchEnabled("true"), true);
assert.equal(isFedexPrintBatchEnabled("false"), false);
assert.equal(isFedexPrintBatchEnabled(undefined), false);
assert.equal(isFedexPrintBatchEnabled(null), false);
console.log("  ✓ printer cron is paused unless crm_settings is exactly true");

assert.equal(shouldPreserveExistingPrintBatchRun("sent", "skipped"), true);
assert.equal(shouldPreserveExistingPrintBatchRun("skipped", "sent"), false);
assert.equal(shouldPreserveExistingPrintBatchRun("empty", "skipped"), false);
assert.match(
  readFileSync("app/api/postlogic/send-batch/route.ts", "utf8"),
  /recordPrintBatchRun/
);
assert.match(
  readFileSync("app/api/postlogic/send-batch/route.ts", "utf8"),
  /status: "skipped"/
);
console.log("  ✓ skipped windows are recorded and cannot overwrite a send");

const sendBatch = readFileSync("app/api/postlogic/send-batch/route.ts", "utf8");
assert.match(sendBatch, /notifyPacketSendOps/);
assert.match(sendBatch, /Packet batch did not send/);
assert.match(sendBatch, /fetchFedexPrintBatchEnabled/);
assert.match(sendBatch, /fedex_print_batch_disabled/);
assert.match(sendBatch, /success: true/);
assert.match(
  readFileSync("app/api/packets/manual-send/route.ts", "utf8"),
  /fetchFedexPrintBatchEnabled/
);
console.log("  ✓ send/cron failures notify Jessica and Developer only");
console.log("  ✓ cron and manual send honor the printer pause toggle");

const queuePending = readFileSync("lib/packets/queue-pending-fedex.ts", "utf8");
assert.match(queuePending, /status: "Pending"/);
assert.doesNotMatch(queuePending, /batch_id:/);
assert.match(
  readFileSync("app/api/packets/resend/route.ts", "utf8"),
  /queuePendingPrimaryFedex/
);
assert.match(
  readFileSync("app/(crm)/clients/[id]/ClientStageHeader.tsx", "utf8"),
  /queuePendingPrimaryFedex/
);
console.log("  ✓ AM, Resend, and eSign share one Pending insert with no batch_id");

const batchAction = readFileSync("app/api/packets/batch-action/route.ts", "utf8");
assert.doesNotMatch(batchAction, /recover_data|fix_june11|diagnose_june14|restore_june14|archive_june8/);
console.log("  ✓ June one-off recover actions are gone");

const sendRecipients = readFileSync("lib/postlogic/send-fedex-recipients.ts", "utf8");
assert.match(sendRecipients, /carrier_status: "Processing"/);
assert.match(sendRecipients, /\.eq\("status", "Processing"\)/);
assert.doesNotMatch(
  sendRecipients,
  /in\("status", \["Processing", "In Transit"/
);
const shipmentTable = readFileSync("app/admin/fedex-batches/ShipmentTable.tsx", "utf8");
assert.match(shipmentTable, /carrier_status/);
assert.match(shipmentTable, /mapPostlogicStatusToLabel/);
console.log("  ✓ send cascade writes tab only; Sent badge reads carrier_status");

assert.equal(mapPostlogicStatusToLabel("Processing"), "Received");
assert.equal(mapPostlogicStatusToLabel("Production"), "Printing");
assert.equal(mapPostlogicStatusToLabel("Label Created"), "Labeled");
assert.equal(mapPostlogicStatusToLabel("In Transit"), "Shipped");
assert.equal(mapPostlogicStatusToLabel("Out for Delivery"), "Out");
assert.equal(mapPostlogicStatusToLabel("Delivered"), "Delivered");
assert.ok(
  isUndefinedColumnError(
    {
      code: "42703",
      message: 'column client_fedex_shipments.carrier_status does not exist',
    },
    "carrier_status"
  )
);
const migrateSrc = readFileSync("scripts/migrate.mjs", "utf8");
assert.match(migrateSrc, /Refusing to build/);
assert.match(migrateSrc, /MIGRATE_SKIP=1 is not allowed on production/);
console.log("  ✓ short badges; missing carrier_status cannot skip production SQL");

console.log("\nAll packet-manager tab checks passed.");
