/**
 * Pre-deploy gate for CRM list + POA upload speed work.
 *
 * Fails if a "make it faster" change would change live side effects:
 * drips, appointments, collection-letter / attorney path,
 * POA auto-advance stages, or RLS-facing list filters.
 *
 * Run: npm run test:perf-invariants
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "path";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

console.log("CRM perf invariant smoke test\n");

const uploadComplete = read("app/api/clients/documents/upload-complete/route.ts");
const poaAdvance = read("lib/clients/poa-upload-advance.ts");
const persistEsign = read("lib/esign/persist-completed.ts");
const documentsTab = read("app/(crm)/clients/[id]/DocumentsTab.tsx");
const stageHeader = read("app/(crm)/clients/[id]/ClientStageHeader.tsx");
const stageEntry = read("lib/reminders/stage-entry-appointments.ts");
const caseSent = read("lib/clients/case-sent-triggers.ts");
const listQuery = read("lib/clients/clients-list-query.ts");
const tabCounts = read("lib/clients/tab-counts.ts");
const allowlist = read("lib/attorney/portal-api-allowlist.ts");

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

assert.match(poaAdvance, /account_manager/);
assert.match(poaAdvance, /client_services/);
assert.match(poaAdvance, /awaiting_collection_letter/);
assert.match(poaAdvance, /\.is\("poa_signed_at", null\)/);
console.log("  ✓ POA auto-advance still AM + CS; poa_signed_at is first-write-only");

const functionsSql = read("supabase/migrations/0004_functions.sql");
const poaFn = functionsSql.slice(
  functionsSql.indexOf("CREATE FUNCTION public.handle_poa_upload()"),
  functionsSql.indexOf("CREATE FUNCTION public.insert_auto_reminders_from_templates")
);
assert.ok(poaFn.includes("handle_poa_upload"), "handle_poa_upload must live in the squashed functions");
assert.match(poaFn, /account_manager/);
assert.match(poaFn, /client_services/);
assert.match(poaFn, /awaiting_collection_letter/);
console.log("  ✓ handle_poa_upload still advances AM and CS");

assert.match(
  documentsTab,
  /from ["']@\/lib\/clients\/documents-upload-client["']/,
  "Documents tab must use the API upload helper, not the leftover server action"
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

assert.doesNotMatch(
  persistEsign,
  /fedex|postlogic|shipment/i,
  "Signed e-sign filing must not reintroduce shipping side effects"
);
assert.match(persistEsign, /advanceClientAfterPoaUpload/);
console.log("  ✓ signed Welcome Packet still advances stage and files no shipment");

const stageBlockers = read("lib/workflow/stage-blockers.ts");
assert.match(stageBlockers, /blockAdvanceFromAccountManagerWithoutSignedWelcomePacket/);
assert.match(stageHeader, /blockAdvanceFromAccountManagerWithoutSignedWelcomePacket/);
console.log("  ✓ Account Manager exit is gated on a signed Welcome Packet");

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

const tabCountFn = functionsSql.slice(
  functionsSql.indexOf("CREATE FUNCTION public.crm_client_tab_counts"),
  functionsSql.indexOf("CREATE FUNCTION public.current_client_id()")
);
assert.match(tabCountFn, /SECURITY INVOKER/);
assert.doesNotMatch(tabCountFn, /SECURITY DEFINER/);
assert.match(tabCountFn, /crm_client_tab_counts/);
console.log("  ✓ tab-count RPC is SECURITY INVOKER (RLS still applies)");

assert.match(
  documentsTab,
  /effectiveType === ["']collection_letter["'][\s\S]*router\.refresh\(\)/,
  "Collection-letter upload must still full-refresh the profile"
);
console.log("  ✓ collection-letter upload still refreshes the profile");

console.log("\nAll perf invariant checks passed.");
