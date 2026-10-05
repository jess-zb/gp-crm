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

### 2026-10-05 — Deleted client files are archived

Removing a file from a client profile sets `documents.archived_at` and leaves the storage object in `client-documents`. The profile, attorney case, and client portal no longer show it. Activity records `document_deleted`. Collection letters, POA files, and signed e-sign files still cannot be removed. Authenticated users cannot hard-delete a document row or a storage object that still has a row.

Code: `archiveClientDocument` in `app/(crm)/clients/[id]/actions.ts`. Migration: `0024_archive_client_documents.sql`.

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

### 2026-10-03 — Client E-Sign section is hidden until a Dev shows it

The E-Sign card on a client's Documents tab is hidden. A Dev sees Show E-Sign, and Hide once it is open. That choice is stored in `staff_feature_flags` (`client_esign_section`) and applies to every staff member. Signing links and the E-Sign Documents editor stay available. Uploads on the Documents tab stay visible.

### 2026-10-03 — Knowledge Base is a role walkthrough

Staff articles live in `knowledge_base_articles`, grouped by `category`. The starter set is replaced, including the article that said a missing card authorization does not block leaving Account Manager. The guide is organized as Start here, Account Managers, Client Services, Working a client, and Admins. Pictures are files in `public/kb`. Attorneys still cannot open this page; their portal is Cases. The guide does not use the word Developer. The Start here titles are Learning Guide, Navigate System, Roles & Departments, and Word Dictionary.

### 2026-10-03 — Dashboard, sidebar, and client profile

Each staff role gets one dashboard: greeting, three counts, a work list, the week of appointments, and a follow-up list.

- Admins see Missing CC, Clients Moved, and Appointments Today. The list is clients missing a credit card authorization. The side list is who changed stage today.
- Account Managers see their Account Manager clients, who needs a call, and their appointments.
- Client Services sees their clients, POA overdue, and their appointments. Someone in both departments sees the Account Manager dashboard.
- A missing card authorization is what blocks leaving Account Manager. The dashboard does not say otherwise.

Sidebar order is Dashboard, Clients, Pipeline, Appointments, Knowledge Base, then Operations: Team, E-Sign Documents, Attorney Queue, Reports, Settings. The role under a person's name wraps onto its own line so it is not cut off.

On a client, the MID menu sits with the tabs and reads `MID · {name}`. Edit beside Account Manager opens Settings. Contact order is verbal password, then email and phones. The missing-paperwork link stays on Overview only. Assignment menus on Settings are the searchable list with a check on the selected row. There is no attorney helper sentence under Assigned Attorney.
