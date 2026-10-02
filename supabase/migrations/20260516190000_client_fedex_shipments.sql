CREATE TABLE IF NOT EXISTS client_fedex_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('primary', 'secondary')),
  carrier text NOT NULL DEFAULT 'fedex',
  batch_id text,
  batch_date date,
  status text,
  advisor text,
  merchant text,
  street_address text,
  city text,
  state text,
  zip_code text,
  phone text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_fedex_shipments_client_id
  ON client_fedex_shipments (client_id);

CREATE INDEX IF NOT EXISTS idx_client_fedex_shipments_batch_id
  ON client_fedex_shipments (batch_id)
  WHERE batch_id IS NOT NULL;

ALTER TABLE client_fedex_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leadership manage client fedex shipments"
  ON client_fedex_shipments FOR ALL
  USING (current_user_role() IN ('dev', 'admin', 'acct_manager'));
