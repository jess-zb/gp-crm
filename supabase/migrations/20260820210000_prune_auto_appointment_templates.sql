-- Phase 2: disable unused auto-appointment *templates* (do not delete rows).
-- Staff can turn a template back on with is_active = true.
--
-- All templates are inactive, including Cards Charged and AM Enrollment Follow-Up.
-- App auto-create that remains (not templates):
--   CS Intro Call, POA Follow Up
-- Case Sent notify is disabled in app code (queue already emails client + attorney).
--
-- Open tasks from disabled templates are cancelled (not deleted) so they
-- leave the working queue. Completed history is untouched.
-- Existing Retention / 30-60-90 rows are left as-is (stop creating new ones only).

UPDATE reminder_templates
SET
  title = 'AM Enrollment Follow-Up',
  description = 'Follow up with a client still in Account Manager (enrollment), not packet delivery'
WHERE stage = 'welcome_packet'
  AND (
    title = '7 Day Call'
    OR description ILIKE '%packet delivery%'
  );

UPDATE reminder_templates
SET is_active = false;

UPDATE reminders r
SET cancelled = true
FROM reminder_templates t
WHERE r.from_template_id = t.id
  AND t.is_active = false
  AND r.completed = false
  AND COALESCE(r.cancelled, false) = false;
