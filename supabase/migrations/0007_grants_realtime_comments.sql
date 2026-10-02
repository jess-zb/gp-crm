-- Role grants, realtime publications and column comments
--
-- Golden Pathway baseline. Generated once from a verified database, then
-- maintained by hand. See docs/golden-pathway-plan.md section 7.4.
COMMENT ON SCHEMA public IS 'standard public schema';

COMMENT ON COLUMN public.client_cards.authorization_status IS 'Authorization lifecycle: pre_auth, pending, approved, decline, dead, refund, chargeback, balance_transfer, closed';

COMMENT ON COLUMN public.clients.unsubscribed_at IS 'Set when the client unsubscribes (portal link or Resend complaint/bounce). Dispatch skips/cancels when non-null.';

COMMENT ON COLUMN public.clients.attorney_portal_assigned_at IS 'When staff released this case to the assigned attorney via Attorney Queue.';

COMMENT ON COLUMN public.clients.attorney_portal_assigned_by IS 'CRM user who bulk-assigned this client to the attorney portal.';

COMMENT ON COLUMN public.clients.attorney_portal_attorney_name IS 'Display name of the attorney at portal-assignment time (Attorney Queue history).';

COMMENT ON COLUMN public.onboarding_checklist.item_key IS 'Stable identifier for the item. Preferred over matching on `item` text.';

COMMENT ON COLUMN public.onboarding_checklist.phase IS 'Which checklist this row belongs to: onboarding (legacy, trigger-driven) or client_services (Priority board).';

COMMENT ON COLUMN public.refunds.processor_mid IS 'Payment processor / MID the original charge ran on. Free text, populated from MERCHANT_OPTIONS.';

COMMENT ON COLUMN public.refunds.needs_review IS 'True when the row was inferred by a backfill and a human has not confirmed the amount or processor.';

COMMENT ON COLUMN public.reminders.appointment_type_key IS 'Stable slug for automation and future grouping; legacy appointment_type unchanged.';

COMMENT ON COLUMN public.reminders.department IS 'Operational queue (sales|retention|service|legal). Dual-write with pipeline_type during migration.';

COMMENT ON COLUMN public.reminders.workflow_source IS 'Origin: manual, template, import, migration, system.';

COMMENT ON COLUMN public.reminders.origin_stage IS 'Pipeline stage this task was created under (for stage-transition orchestration).';
