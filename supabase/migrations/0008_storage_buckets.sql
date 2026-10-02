-- Storage buckets.
--
-- The source project created `client-documents` by hand in the dashboard — the
-- INSERT was commented out of its schema file and no migration added it — so
-- every document upload, attorney download and signed e-sign filing depended on
-- a manual step. All buckets are declared here so a new database is
-- reproducible from migrations alone.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-documents', 'client-documents', false, 524288000)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', false, 26214400)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('esign-templates', 'esign-templates', false, 8388608)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

-- Staff reach client documents through server routes using the service role,
-- which bypasses these policies. The authenticated grants keep browser
-- signed-URL uploads working.
DROP POLICY IF EXISTS "Staff manage client documents" ON storage.objects;
CREATE POLICY "Staff manage client documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'client-documents' AND public.current_user_role() IN ('dev', 'admin', 'acct_manager'))
  WITH CHECK (bucket_id = 'client-documents' AND public.current_user_role() IN ('dev', 'admin', 'acct_manager'));

DROP POLICY IF EXISTS "Staff read chat attachments" ON storage.objects;
CREATE POLICY "Staff read chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Staff upload chat attachments" ON storage.objects;
CREATE POLICY "Staff upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');
