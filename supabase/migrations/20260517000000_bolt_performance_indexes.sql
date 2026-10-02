-- ⚡ Bolt: Performance indexes for common query patterns

-- 1. Clients table: Optimize active filtering and common sorting by name
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_is_active
  ON clients (is_active)
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_last_first_name
  ON clients (last_name, first_name);

-- 2. Reminders table: Optimize filtering by due date and completion status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reminders_due_date_completed
  ON reminders (due_date, completed);

-- 3. Audit Log: Optimize lookups by action and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_action_created_at
  ON audit_log (action, created_at);

-- 4. Sequence Enrollments: Optimize active enrollment processing
-- (Complements existing partial index idx_sequence_enrollments_active_next_send)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sequence_enrollments_status_next_send_at
  ON sequence_enrollments (status, next_send_at)
  WHERE status = 'active';
