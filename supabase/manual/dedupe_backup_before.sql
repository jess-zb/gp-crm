-- ============================================================================
-- RUN BEFORE: client dedupe / merge (dedupe.js)
-- Purpose: logical backup of rows you may mutate — adjust schema names if needed.
-- ============================================================================
-- Recommended: also take a Supabase dashboard backup / pg_dump snapshot for prod.
-- ============================================================================

-- Full-table snapshot (timestamp suffix is manual — replace YYYYMMDD).
CREATE TABLE IF NOT EXISTS clients_backup_pre_dedupe AS
SELECT * FROM clients;

CREATE TABLE IF NOT EXISTS communications_backup_pre_dedupe AS
SELECT * FROM communications;

CREATE TABLE IF NOT EXISTS reminders_backup_pre_dedupe AS
SELECT * FROM reminders;

CREATE TABLE IF NOT EXISTS onboarding_checklist_backup_pre_dedupe AS
SELECT * FROM onboarding_checklist;

-- Optional: other tables that reference clients(id) (uncomment if they exist)
-- CREATE TABLE IF NOT EXISTS notifications_backup_pre_dedupe AS SELECT * FROM notifications;
-- CREATE TABLE IF NOT EXISTS documents_backup_pre_dedupe AS SELECT * FROM documents;
-- CREATE TABLE IF NOT EXISTS audit_log_backup_pre_dedupe AS SELECT * FROM audit_log;

COMMENT ON TABLE clients_backup_pre_dedupe IS 'Snapshot before dedupe.js — safe to drop after verification.';
