-- Collection letters, CC authorizations, and POA files cannot be deleted.
-- RESTRICTIVE: must pass in addition to any PERMISSIVE FOR ALL / DELETE policies.

CREATE POLICY lock_permanent_client_document_deletes
  ON documents
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    NOT (
      COALESCE(is_collection_letter, false)
      OR document_type::text IN (
        'collection_letter',
        'poa_document',
        'poa',
        'poa_signed',
        'power_of_attorney'
      )
    )
  );
