-- Public attorney-batch download links use the service role (no login).
-- Tables were originally granted only to authenticated, which broke the
-- tokenized public page with "permission denied" → "Invalid link".

GRANT SELECT ON attorney_batches TO service_role;
GRANT SELECT ON attorney_batch_clients TO service_role;
GRANT SELECT ON attorney_batch_documents TO service_role;
