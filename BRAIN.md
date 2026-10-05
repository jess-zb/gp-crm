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

### 2026-10-05 — Partner lead intake stays private

Do not put these instructions in the Knowledge Base, a public page, or an email. The API key is not written in this file.

`POST https://goldenpathway.vercel.app/api/leads` accepts one client `.txt` file per request. Send `Authorization: Bearer` or `X-Api-Key`. The secret is `LEADS_API_KEY`, stored only in the Vercel project environment and in local `.env.local`. If it is unset, every request is refused.

The body is the text file. Name it with `X-File-Name: CLIENT NAME.txt`, or upload it as multipart field `file`. Each file creates a new lead, even when the name or phone was sent before. Nothing is looked up or updated.

Copied onto the lead: first name, last name, mobile phone, a second phone only when it is different, street, city, state, ZIP, and email. Names, street, and city are Title Case. State is two letters. Email is lowercase. The original file is saved on Documents as Enrolled Cards. Other lines in the file stay in that file. These leads do not start the welcome emails.

A request without the key is rejected. The key is checked by its hash, and it is never read from the URL. A correct key can create at most 60 leads in a minute and 2,000 in a day. Past that, the route returns 429. If the limit cannot be checked, the route refuses the lead. A body that is not the text file is refused.

Code: `app/api/leads/route.ts`, `lib/leads/`.

### 2026-10-05 — Appointments are booked in the client's time

Supersedes the same-day note that the appointment fields are the Arizona clock. The date and time you enter are the client's time, from their state and ZIP. Each appointment then shows three clocks: the client's time, Arizona time, and the time on the computer of the person looking at it. Arizona stays the office day for the dashboard. A client with no state is booked in Arizona until a state is added.

The two appointments already on file were entered as the client's clock and had been stored on an Eastern computer clock. Gloria Jackson is 10:00 AM Pacific on October 6. Daniel Holter is 11:00 AM Pacific on October 7.

### 2026-10-05 — Appointments use Arizona time and the client's clock

Superseded the same day by the entry above. The fields are the client's time, not Arizona.

### 2026-10-05 — Staff direct lines travel with the name

Team → Edit member stores a direct line on the profile. That number shows with the person's name wherever they appear as the Account Manager or the Client Services assignee: the client profile, the clients list, the pipeline, settings, assignment menus, appointments, and reports. A blank line stays hidden.

### 2026-10-05 — Communications live in Overview Notes

The Activity tab is gone. Calls, texts, emails, and notes accumulate in Overview, under **Notes**, with the same title and small icon buttons. Each entry stays short until it is clicked, then the full message opens in that row. The activity log sits under that list. This supersedes the earlier line that sent a note click to a Communications tab.

### 2026-10-05 — Client edits wait until you leave the field

Editing a client does not save between keystrokes. **Save Changes** writes the form. Closing the edit dialog, hiding the tab, or leaving the page also writes whatever is still unsaved. A refresh while the dialog is open does not replace the text still being typed.

### 2026-10-05 — Overview and Communications stay readable

Communications shows the full message for a call, text, email, or note. There is no character cutoff and no Show more.

Overview lists Appointments, then Notes. A note on Overview stays short. Clicking it opens Communications on that same message. Saving a communication or an overview note puts it on the list immediately. A refresh is not required to see it.

Client Services and Account Manager menus include every admin, plus anyone checked for that department. The hidden dev account stays off those lists. The menu opens above the page so the names are not clipped.

Rule: `.cursor/rules/client-profile-comms.mdc`.

### 2026-10-05 — Deleted client files are archived

Removing a file from a client profile sets `documents.archived_at` and leaves the storage object in `client-documents`. The profile, attorney case, and client portal no longer show it. Activity records `document_deleted`. Collection letters, POA files, and signed e-sign files still cannot be removed. Authenticated users cannot hard-delete a document row or a storage object that still has a row.

Code: `archiveClientDocument` in `app/(crm)/clients/[id]/actions.ts`. Migration: `0024_archive_client_documents.sql`.

### 2026-10-05 — Admins are in both departments

An admin appears on every Account Manager list and every Client Services list: new client, client Settings, the stage assignment prompt, Reports department filters, and the e-sign Account Manager names. The department checkboxes on Team are for Users. An admin does not need them checked. The leadership dashboard is unchanged.

Code: `belongsToDepartment` in `lib/team/department-members.ts`.

### 2026-10-05 — Each partner text file is a new lead

The partner export copies only first name, last name, mobile phone, a different second phone, street, city, state, ZIP, and email. Names, street, and city are stored with the same Title Case used on e-sign (`toTitleCaseName`). State is the two-letter abbreviation. Email is lowercase. The original `.txt` is stored on Documents as `upload` (Enrolled Cards). The document name is Title Case (`Gloria Weaver.txt`). A repeated name or phone creates another lead. The API does not look up or update an existing client. Card numbers, the verbal password, date of birth, and the rest of the sheet stay in that file.

This supersedes the same-day note that a matching phone would attach the file to the existing client and that cards would be written onto the client.

Code: `lib/leads/parse-partner-export.ts`, `lib/leads/save-partner-export.ts`.

### 2026-10-05 — Partner leads can arrive as the downloaded text file

Superseded the same day by the entry above. A matching phone no longer attaches to an existing client, and cards are no longer copied onto the client.

The same `POST /api/leads` key accepts the partner's `.txt` export (`text/plain`, a multipart `file`, or JSON `{ "text" }`). The CRM fills the lead from that file: name, phones, address, email, date of birth, SSN, and verbal password. Each card is stored as bank name, last four, card type, and charge amount. The full card number and security code are not copied onto the card row. The original file is saved on Documents as type `other`. A matching phone attaches the file to the existing client. This import cancels the automatic welcome email so the file does not start a drip. The earlier JSON field body still works.

Code: `lib/leads/parse-partner-export.ts`, `lib/leads/save-partner-export.ts`.

### 2026-10-05 — Partners send leads through one API key

An outside CRM can create a Lead without any other access. `POST /api/leads` takes first name, last name, phone, street, city, state, and ZIP. Email and a short source label are optional. The route checks `LEADS_API_KEY` (`Authorization: Bearer` or `X-Api-Key`) and is public in middleware so it does not wait on a staff session. A matching phone returns the existing client instead of a second file. The new row is stage `lead`, active, with no Account Manager and no MID. Staff assign those the same way as any other lead. A note on the client says it arrived through the partner API.

Code: `app/api/leads/route.ts`, `lib/leads/parse-inbound-lead.ts`. Instructions for the partner: `docs/partner-lead-api.md`. The key itself is only in the host environment.

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
