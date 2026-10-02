# Workflow reminder system — QA & regression plan (launch)

Use this checklist before and after production deployment of the workflow reminder work (columns like `appointment_type_key`, `workflow_source`, `pipeline_type`, department queues, and legacy fallbacks). **Goal:** same user-visible behavior as validated on staging; catch regressions in creation, completion, notifications, and data backfills.

**Test environment:** record results in a copy of this doc or a ticket; note tester, date, and build/commit.

---

## 1. Reminder creation tests

Validate that new rows are created with the expected metadata and visible in the UI.

| Area | What to validate | Pass criteria |
| --- | --- | --- |
| **Manual reminders** | Create from **Reminders → Add appointment** (`createReminder` in `app/(crm)/reminders/actions.ts`) | Row appears open; `due_date`, `assigned_to`, `description` correct; **`workflow_source`** = `manual`. |
| **Manual (client sidebar)** | Create from client sidebar reminder form | Same as manual; **`workflow_source`** = `manual`. |
| **Auto-generated reminders** | Trigger paths that insert from **reminder templates** / stage automation (e.g. collection-letter flow per `insert_auto_reminders_from_templates` in migrations) | `auto_generated` / `from_template_id` behave as today; **`workflow_source`** set per app path (`template`, `migration`, etc. — confirm in DB for each path). |
| **Imported reminders** | Run/import path used in production (`import.js` / migration helpers) | Rows visible; **`workflow_source`** = `import` (or `migration`) where intended; legacy `appointment_type` / `description` preserved. |
| **Sidebar reminders** | Same as client sidebar + any quick-add paths | Queues and client detail show the new row. |
| **Template reminders** | Stage transition or admin template that calls template key resolution (`lib/reminders/workflow.ts` — `workflow_source: "template"`) | **`appointment_type_key`** matches template mapping; description matches template text. |
| **Department assignment** | For each creation path, check inferred **department** / queue membership | Matches client stage and pipeline rules (`inferDepartment` / `inferPipelineFromClientStage` from `lib/reminders/workflow-config.ts` & `workflow-keys.ts`). Spot-check: sales vs service vs legal vs retention clients. |
| **`appointment_type_key`** | Modal / form **appointment type** selections | Persisted key aligns with `workflow-config.ts` / `APPOINTMENT_LABEL_TO_KEY`; not null for new typed appointments where the UI supplies a type. |
| **`workflow_source` population** | Query `reminders` after each path | Only expected enum values: `manual`, `template`, `import`, `migration`, `system` (see migration comments on column). |

**SQL spot-check (read-only):**

```sql
select id, workflow_source, appointment_type_key, appointment_type, description, auto_generated, from_template_id
from reminders
order by created_at desc
limit 20;
```

---

## 2. Reminder completion tests

| Area | What to validate | Pass criteria |
| --- | --- | --- |
| **Manual complete** | Mark complete from Appointments list / client UI | `completed` = true; **`completed_at`** set (if column used in app); row leaves open queues; audit trail if applicable. |
| **Legacy reminders** | Old rows: null `appointment_type_key`, old `appointment_type` string | Still completable manually. |
| **`completed_at`** | Complete and cancel flows | Timestamps consistent with product rules; no null where UI expects completion time. |
| **Audit behavior** | If audit tables / `performed_by` exist on completion | Logged for staff actions; automated completion records system/cron identity per current design. |
| **Cancelled reminders** | Set `cancelled` = true | Hidden from default open lists; do not receive “due soon” notifications; do not block stage logic incorrectly. |

---

## 3. Stage transition tests

| Area | What to validate | Pass criteria |
| --- | --- | --- |
| **Forward stage movement** | Move client to next stage | Expected template reminders created; no duplicate spam from double triggers. |
| **Backward stage movement** | Revert stage | Cancellation / cleanup rules match spec (auto-cancel of future reminders if implemented); no orphaned inconsistent state. |
| **Auto-cancel behavior** | Transitions that should cancel open reminders | Reminders cancelled or completed per business rules; queues update. |
| **Auto-complete behavior** | Transitions that complete specific tasks | Matching reminders complete; others untouched. |
| **Duplicate prevention** | Repeat same transition or re-save stage | No duplicate open reminders for the same logical task (where prevention exists). |
| **POA blocker** | Client stage / document rules around POA | Stage cannot advance (or shows blocker) until POA satisfied; reminders align with blocker UX. |
| **Collection letter flow** | Upload / event that fires collection-letter handler | Auto reminders from templates insert correctly; **`workflow_source`** / keys correct for those rows. |

---

## 4. Department queue tests

Exercise **Sales**, **Retention**, **Service**, **Legal** department filters or tabs (whatever the CRM exposes).

| Queue | What to validate | Pass criteria |
| --- | --- | --- |
| **Sales** | Clients in sales pipeline / stages | Open reminders appear under sales queue; mixed `pipeline_type` rows behave as before. |
| **Retention** | Retention-labeled clients | Correct inclusion; no leakage from service-only rows. |
| **Service** | Service pipeline | Matches `inferPipelineFromClientStage` + department mapping. |
| **Legal** | Legal-stage clients | Reminders visible and assignable. |
| **Mixed legacy reminders** | Clients with old rows (null key, old labels) | Still appear in the correct queue; no empty groups or “lost” rows. |

---

## 5. Existing data regression tests

| Area | What to validate | Pass criteria |
| --- | --- | --- |
| **Old reminders still visible** | Production-like copy: pre-migration rows | List and client views show historical open/completed items. |
| **Imported rows still render** | Bulk import sample | No blank cards; dates and assignees display. |
| **Reminders without keys** | `appointment_type_key` IS NULL | Grouping in Appointments view matches **legacy** behavior (`appointment_type` → `description` → “Other”); order of groups unchanged from baseline. |
| **Old appointment labels** | Legacy `appointment_type` strings | Display strings match what users saw before refactor (no silent relabeling in UI). |

---

## 6. Notification tests

Primary implementation: **`GET/POST /api/notifications/appointments`** (`app/api/notifications/appointments/route.ts`) — due window **now → now + 60 minutes**; auth via `vercel-cron/1.0` or `x-cron-secret: zb-cron-2026` (same pattern as other cron routes).

| Area | What to validate | Pass criteria |
| --- | --- | --- |
| **60 minute reminder cron** | Schedule fires (Vercel Cron and/or **pg_cron** if configured — see commented example in `supabase/migrations/20260503120000_announcements.sql`) | Route returns 200; notifications inserted for due reminders in window. |
| **`assigned_to` handling** | Reminder with assignee | Notification targets assignee’s `user_id` (or current rule in route); unassigned path matches spec. |
| **Overdue behavior** | Reminder past `due_date` | Does not get “upcoming” duplicate each hour if already notified (confirm idempotency / filters in route implementation). |
| **Duplicate notifications** | Same reminder still in window on next cron tick | No duplicate **notifications** rows for the same reminder+user (per route logic). |

**Manual invoke (staging):**

```bash
curl -sS -H "x-cron-secret: zb-cron-2026" "https://<staging-host>/api/notifications/appointments"
```

---

## 7. Production deployment checklist

Complete in order; sign off each line.

- [ ] **Run migrations:** apply all pending Supabase migrations (including `20260506150000_workflow_reminders_phase1.sql` and related) on staging first, then production; confirm no failed statements.
- [ ] **Verify env vars:** `NEXT_PUBLIC_APP_URL`, Supabase URL/keys, **`HOLIDAY_MODE`** awareness for email/notifications (`app/api/cron/dispatch-emails/route.ts`), Resend/email if touched by flows under test.
- [ ] **Backup production DB:** snapshot or verified backup window before migrate + deploy.
- [ ] **Deploy staging first:** full QA pass using sections 1–7; compare behavior to production baseline screenshots or notes.
- [ ] **Smoke test after deploy:** login, open Reminders + one client record, complete one reminder, advance one stage, confirm bell notifications.
- [ ] **Verify cron jobs:** `vercel.json` — `/api/cron/dispatch-emails`, `/api/cron/missed-appointments`, `/api/cron/holiday-autoresponder`; plus **scheduled call to `/api/notifications/appointments`** if maintained outside `vercel.json` (Supabase pg_cron).
- [ ] **Verify Supabase triggers/functions:** reminder template inserts, collection-letter triggers, RLS unchanged for staff roles.
- [ ] **Attorney portal unaffected:** no regressions on attorney-facing surfaces (per launch scope — confirm login and critical read paths).

---

## 8. Rollback plan

**Revert deployment**

1. Roll back the **hosting deployment** (e.g. Vercel → Promote previous production deployment or redeploy prior Git tag).
2. If migrations were applied that are **backward incompatible**, do **not** roll back DB blindly without a migration-down plan — prefer keeping schema and rolling forward with a fix. If migration was additive-only (new nullable columns), app rollback alone may be sufficient.

**Disable new workflow logic safely (operational)**

- **Pause automation:** Disable or reschedule the **email dispatch** cron (`/api/cron/dispatch-emails`) and optional **notifications/appointments** cron to stop automated side effects while investigating.
- **No code change required for “read-only” mitigation:** older app versions that ignore new columns continue to read legacy fields; confirm with engineering whether rolled-back app expects new columns (NOT NULL constraints, etc.).

**Restore old reminder behavior**

1. Deploy last known-good **application** build from before workflow changes.
2. Keep **database** at current revision if columns are additive; staff can continue using legacy `appointment_type` / `description` in UI.
3. If data repair is needed after a bad deploy, restore from **pre-deploy backup** only with legal/ops approval and a written runbook.

**Communication:** Document incident channel, owner, and “stop the line” criteria (e.g. mass erroneous completions or missing legal queue items).

---

## Appendix: quick reference paths

| Concern | Location |
| --- | --- |
| Workflow orchestration | `lib/reminders/workflow.ts` |
| Config / keys | `lib/reminders/workflow-config.ts`, `lib/reminders/workflow-keys.ts` |
| Appointments aggregation | `app/(crm)/reminders/AppointmentsView.tsx`, `lib/reminders/appointments.ts` |
| 60-minute notifications | `app/api/notifications/appointments/route.ts` |

_End of checklist._
