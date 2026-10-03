# Golden Pathway CRM brain

Living product memory. Locked behavior is enforced in `.cursor/rules/`. This file records why those choices exist and any decision that is newer than the rules.

Read this before changing stage gates, e-sign, documents, or client-facing behavior. When a decision is settled, append a short dated entry. Do not delete earlier entries; mark one superseded if it changes.

## Where it runs

- Live: `https://goldenpathway.vercel.app` (`DEFAULT_APP_URL`). Production deploys from `main` on `jess-zb/gp-crm`.
- Local app: `http://127.0.0.1:43123`. Local Supabase API `55321`, Postgres `55322`.
- A document added on local is a real template in the local database. Deactivate or delete it after testing.

## Current picture (2026-10-03)

- Staff departments are Account Managers and Client Services. MIDs are labels, not tenancy. There is no physical mail and no third-party e-sign vendor.
- Leaving Account Manager for a later pipeline stage requires a signed credit card authorization on file (`cc_authorization`), from e-sign or a direct upload.
- Leaving Client Services for Awaiting Collections still requires a signed POA.
- Cancel and disqualify destinations stay open with no paperwork: `retention`, `dnc`, `not_interested`, `dnq`, `mortgage`, `closed`.
- Uploading any e-sign PDF suggests general client fields from the text. Cards, amounts, and anything the scan misses stay manual in the drag-and-drop editor. Staff edit values in Confirm Before Sending.

## Decisions

### 2026-10-03 — Account Manager exit is a signed CC authorization

A client cannot move from `account_manager` into a later pipeline stage until a `cc_authorization` document is on file. The blocked Advance dialog links to Documents → E-Sign and to Upload with CC Authorization already selected. There is no bypass.

The Welcome Packet is no longer that gate. Its signed copy is stored as `poa_signed` and still drives POA auto-advance (Account Manager or Client Services → Awaiting Collections). CC Auth never auto-stages. Audio is never a stage gate.

Code: `lib/workflow/stage-blockers.ts` (`blockAdvanceFromAccountManagerWithoutCcAuth`, `hasCcAuthorizationOnRecord`). Rule: `.cursor/rules/onboarding-stage-gates.mdc`.

### 2026-10-03 — General e-sign fields are suggested from the PDF

On upload, and from Suggest general fields in the editor, the CRM reads the PDF text and places percent boxes on exact captions (name, address, email, phone, date, signature, and the other binds in `ESIGN_BIND_KEYS`). Headings such as "CLIENT FULL NAME" place the box in the blank underneath. A sentence that merely contains "name" is ignored. Payment date, card number, expiration, and description of services are not client-file binds, so they stay empty for staff to place.

`pdfjs-dist` stays pinned at 3.11.174. Text extraction loads `pdfjs-dist/legacy` with a runtime `require`, because the Next bundler cannot see the worker file.

Code: `lib/esign/suggest-fields.ts`, `lib/esign/pdf-text.ts`, `app/api/esign/suggest-fields/route.ts`. Rule: `.cursor/rules/esign-and-uploads.mdc`.

### 2026-10-03 — The paused-drip banner lives on Message templates

The "Automated drip emails are paused" notice is on Settings → Message templates, not the dashboard.

### 2026-10-03 — The Clients Priority tab is gone

The Priority board (Client, CS Intro, Tracking Update, and the rest) no longer belongs in this business. Clients now shows All Clients, Active, Archives, and Refunds. A bookmarked `?tab=priority` falls through to the viewer's default list. The profile checklist card mentioned here was removed the same day; see the next entry.

### 2026-10-03 — The Client Services checklist card is gone

The sidebar card on a client profile (CS Intro, Tracking Update, Welcome Packet on file, POA on File) is removed. Entering Client Services no longer writes those checklist rows. A signed POA still gates leaving Client Services for Awaiting Collections. Stored `onboarding_checklist` rows are deleted, and new clients no longer get a hidden set. See `0020_drop_unused_checklist_rows.sql`.

### 2026-10-03 — Missing paperwork is a link, and search is a global jump

There is no progress bar on the client header. The stage dropdown stays. When the next stage is blocked, the header shows “Missing before {next stage}” and the click goes to the missing item: Documents → E-Sign for an unsigned credit card authorization, or the upload form with POA already selected.

The magnifying glass on a client is now a command menu for the whole CRM (`⌘K` / `Ctrl+K`). It jumps to the same pages as the sidebar, gated the same way, and searches clients. Escape or the backdrop closes it. The shortcut sits on a small magnifying-glass control in the bottom-right corner, beside chat. Search covers every client, active or archived, in any stage. A phone typed as digits still matches a formatted number, and a spouse name matches too.
