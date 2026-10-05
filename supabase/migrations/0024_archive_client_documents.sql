-- Removing a file from a client profile archives it. The row and the storage
-- object stay. Authenticated users no longer see or hard-delete those rows.

ALTER TABLE public.documents
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.documents.archived_at IS
  'Set when staff remove a file from the client profile. The row and storage object stay.';

CREATE INDEX documents_active_by_client_idx
  ON public.documents (client_id)
  WHERE archived_at IS NULL;

CREATE POLICY "Hide archived documents"
  ON public.documents
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (archived_at IS NULL);

CREATE POLICY "No hard delete of client documents"
  ON public.documents
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);

-- A filed object stays in the bucket. Cleanup of an upload that never became
-- a documents row is still allowed.
CREATE POLICY "Keep filed client document objects"
  ON storage.objects
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    bucket_id IS DISTINCT FROM 'client-documents'
    OR NOT EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.storage_path = storage.objects.name
    )
  );
