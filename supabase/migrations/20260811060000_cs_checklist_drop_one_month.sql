-- Retires the "1 Month Followup" item from the Client Services checklist. The
-- services reps already work that contact from their appointments, so the item
-- restated something tracked elsewhere and gave the board a fifth column nobody
-- ticked.
--
-- The rows go rather than stay: the app now reads four keys, so these would sit
-- in the table unread and would quietly come back to life if the key were ever
-- reused for something else. Nothing is lost — no client had the item completed,
-- and audit_log keeps checklist history independently of these rows.
--
-- 20260805210000 still seeds the item, so a database built from scratch creates
-- it and then this migration removes it. That is deliberate: an applied
-- migration is history and is left alone.

DELETE FROM onboarding_checklist
WHERE phase = 'client_services'
  AND item_key = 'one_month_followup';
