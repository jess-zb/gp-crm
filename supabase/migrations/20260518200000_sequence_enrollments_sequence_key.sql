-- Enrollments use logical sequence_key (welcome_lead, welcome_cs, …) without email_sequences FK.

ALTER TABLE sequence_enrollments
  ADD COLUMN IF NOT EXISTS sequence_key text;

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_client_sequence_key
  ON sequence_enrollments (client_id, sequence_key);
