-- Support duplicate-review merge (service role + authenticated dev/admin fallback).

GRANT SELECT, INSERT, UPDATE, DELETE ON client_fedex_shipments TO authenticated;
GRANT ALL ON client_fedex_shipments TO service_role;

CREATE POLICY "Leadership update audit log"
  ON audit_log FOR UPDATE
  USING (current_user_role() IN ('dev', 'admin'))
  WITH CHECK (current_user_role() IN ('dev', 'admin'));
