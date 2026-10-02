-- Billing: authorization status on cards
ALTER TABLE client_cards
  ADD COLUMN IF NOT EXISTS authorization_status TEXT NOT NULL DEFAULT 'pre_auth';

COMMENT ON COLUMN client_cards.authorization_status IS
  'Authorization lifecycle: pre_auth, pending, approved, decline, dead, refund, chargeback, balance_transfer, closed';

-- Legacy quick-key rows (sidebar QUICK_REMINDER_MAP). Pipeline templates + titles live in
-- migration 20260430190000_reminder_templates_stage_titles.sql (re-seeds reminder_templates).
DELETE FROM reminder_templates;

INSERT INTO reminder_templates (stage, description, hours_after_stage_entry, is_active)
VALUES
  ('lead-24', 'Lead — Auto Add 24hrs', 24, true),
  ('followup-preauth', 'Follow Up Appointment (Pre-Auth)', 2, true),
  ('followup-charge', 'Follow Up Appointment (Charge)', 2, true),
  ('followup-decline', 'Follow Up Appointment (Decline)', 2, true),
  ('followup-attempt-preauth', 'Follow Up Attempt (Pre-Auth)', 1, true),
  ('appointment-set', 'Appointment Set', 24, true),
  ('prospect-followup', 'Prospect Follow Up', 48, true);
