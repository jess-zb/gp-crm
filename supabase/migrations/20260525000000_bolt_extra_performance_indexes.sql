-- ⚡ Bolt: Extra performance indexes for department assignments and reminders


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_assigned_services_id
  ON clients (assigned_services_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reminders_assigned_to
  ON reminders (assigned_to);
