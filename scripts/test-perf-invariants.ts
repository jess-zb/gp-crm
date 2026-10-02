/**
 * Pre-deploy gate for CRM list + POA upload speed work.
 *
 * Fails if a "make it faster" change would change live side effects:
 * drips, appointments, packets, collection-letter / attorney path,
 * POA auto-advance stages, or RLS-facing list filters.
 *
 * Run: npm run test:perf-invariants
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "path";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

console.log("CRM perf invariant smoke test\n");

const uploadComplete = read("app/api/clients/documents/upload-complete/route.ts");
const poaAdvance = read("lib/clients/poa-upload-advance.ts");
const persistEsign = read("lib/esign/persist-completed.ts");
const documentsTab = read("app/(crm)/clients/[id]/DocumentsTab.tsx");
const onboarding = read("app/(crm)/clients/[id]/OnboardingChecklist.tsx");
const stageHeader = read("app/(crm)/clients/[id]/ClientStageHeader.tsx");
const stageEntry = read("lib/reminders/stage-entry-appointments.ts");
const caseSent = read("lib/clients/case-sent-triggers.ts");
const packets = read("lib/packets/fetch-packet-manager-data.ts");
const fedexFilter = read("lib/postlogic/fedex-ready-filter.ts");
const listQuery = read("lib/clients/clients-list-query.ts");
const tabCounts = read("lib/clients/tab-counts.ts");
const allowlist = read("lib/attorney/portal-api-allowlist.ts");
const queuePending = read("lib/packets/queue-pending-fedex.ts");

assert.doesNotMatch(
  uploadComplete,
  /runStageEntrySideEffects/,
  "Uploads API must not run stage-entry appointment/drip side effects"
);
console.log("  ✓ upload-complete does not call runStageEntrySideEffects");

assert.match(
  uploadComplete,
  /markPoaSignedOnClient/,
  "Uploads API must still set poa_signed_at (trigger does not)"
);
console.log("  ✓ upload-complete still sets poa_signed_at");

assert.match(
  uploadComplete,
  /runCaseSentToAttorneysTriggers/,
  "Collection-letter attorney path must stay on upload-complete"
);
assert.match(uploadComplete, /isCollection|collection_letter/);
console.log("  ✓ collection-letter / case-sent path still present");

assert.match(poaAdvance, /welcome_packet/);
assert.match(poaAdvance, /client_services/);
assert.match(poaAdvance, /awaiting_collection_letter/);
assert.match(poaAdvance, /\.is\("poa_signed_at", null\)/);
console.log("  ✓ POA auto-advance still AM + CS; poa_signed_at is first-write-only");

const poaMigrations = readdirSync(join(root, "supabase/migrations"))
  .filter((f) => f.includes("poa_upload_advance") && f.endsWith(".sql"))
  .sort();
assert.ok(poaMigrations.length > 0, "POA upload advance migrations must exist");
const latestPoaFn = read(`supabase/migrations/${poaMigrations[poaMigrations.length - 1]}`);
assert.match(latestPoaFn, /welcome_packet/);
assert.match(latestPoaFn, /client_services/);
assert.match(latestPoaFn, /awaiting_collection_letter/);
console.log("  ✓ latest handle_poa_upload still advances AM and CS");

assert.match(
  documentsTab,
  /from ["']@\/lib\/clients\/documents-upload-client["']/,
  "Documents tab must use the API upload helper, not the leftover server action"
);
assert.match(
  onboarding,
  /from ["']@\/lib\/clients\/documents-upload-client["']/,
  "Checklist POA upload must use the API upload helper"
);
console.log("  ✓ Uploads UI still uses documents-upload-client (no extra stage-entry path)");

assert.match(
  stageHeader,
  /runStageEntrySideEffectsServerAction/,
  "Manual Advance must still run stage-entry side effects"
);
console.log("  ✓ manual Advance still runs stage-entry side effects");
assert.match(stageEntry, /csIntroCall:\s*true/);
assert.match(stageEntry, /retentionCall:\s*false/);
assert.match(stageEntry, /collectionLetterCheckIns:\s*false/);
console.log("  ✓ auto-appointment flags unchanged");

assert.match(caseSent, /CREATE_CASE_SENT_NOTIFY_APPOINTMENT = false/);
console.log("  ✓ case-sent notify appointment stays off");

assert.match(packets, /loadStageClientRows\(supabase, ["']client_services["']\)/);
assert.match(packets, /loadPendingResendClientIds/);
assert.match(fedexFilter, /"retention"/);
assert.match(fedexFilter, /"dnc"/);
assert.match(fedexFilter, /"closed"/);
console.log("  ✓ Packets Needed still CS first-time + Pending resend; terminal stages excluded");

assert.match(persistEsign, /queuePendingPrimaryFedex/);
assert.match(persistEsign, /kind === ["']welcome_packet["']/);
assert.match(queuePending, /status:\s*["']Pending["']/);
assert.doesNotMatch(
  queuePending,
  /batch_id:/,
  "Pending markers must not stamp batch_id (set only at send)"
);
console.log("  ✓ eSign Welcome Packet still queues FedEx Pending");

assert.match(listQuery, /count:\s*["']exact["']/);
assert.match(
  listQuery,
  /A search spans every client regardless of tab/,
  "Search must keep spanning all tabs"
);
assert.match(listQuery, /2026-06-02T00:00:00\+00:00/);
assert.match(tabCounts, /2026-06-02T00:00:00\+00:00/);
assert.match(tabCounts, /\(dnc,not_interested,dnq,mortgage,closed\)/);
assert.match(listQuery, /\(dnc,not_interested,dnq,mortgage,closed\)/);
console.log("  ✓ client list still exact-counts the page; search/date/active filters unchanged");

assert.match(allowlist, /\/api\/clients\/documents\/download/);
console.log("  ✓ attorney download allowlist untouched");

assert.doesNotMatch(
  uploadComplete,
  /cancelOpenAppointmentsForStage/,
  "POA upload must not start cancelling CS Intro appointments"
);
console.log("  ✓ POA upload does not cancel stage appointments");

const listPerfSql = read(
  "supabase/migrations/20260825180000_clients_list_perf_indexes.sql"
);
assert.match(listPerfSql, /SECURITY INVOKER/);
assert.doesNotMatch(listPerfSql, /SECURITY DEFINER/);
assert.match(listPerfSql, /crm_client_tab_counts/);
console.log("  ✓ tab-count RPC is SECURITY INVOKER (RLS still applies)");

assert.match(
  documentsTab,
  /effectiveType === ["']collection_letter["'][\s\S]*router\.refresh\(\)/,
  "Collection-letter upload must still full-refresh the profile"
);
console.log("  ✓ collection-letter upload still refreshes the profile");

assert.doesNotMatch(
  onboarding,
  /\.update\(\{\s*poa_signed_at/,
  "Checklist POA upload must not overwrite poa_signed_at after markPoaSignedOnClient"
);
console.log("  ✓ checklist POA upload no longer resets poa_signed_at");

console.log("\nAll perf invariant checks passed.");
