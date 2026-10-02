-- Client Services assignee (distinct from accounts / assigned_to)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS assigned_services_id UUID REFERENCES profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_assigned_services
  ON clients (assigned_services_id)
  WHERE assigned_services_id IS NOT NULL;
