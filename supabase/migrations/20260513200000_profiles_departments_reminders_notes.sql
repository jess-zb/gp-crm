-- Department flags (appointments / pipeline visibility) + reminder notes + checklist label

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_accounts BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_services BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE onboarding_checklist
SET item = 'Send Account Manager'
WHERE item = 'Send Welcome Packet + POA';
