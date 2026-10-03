-- The squashed baseline kept attorney and client SELECT policies on clients and
-- documents, and dropped the staff policies those tables still need.
-- Leadership (dev, admin, account manager) creates clients and files documents.

CREATE POLICY "Leadership sees all clients"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (
    public.current_user_role() = ANY (
      ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role]
    )
  )
  WITH CHECK (
    public.current_user_role() = ANY (
      ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role]
    )
  );

CREATE POLICY "Leadership sees all documents"
  ON public.documents
  FOR ALL
  TO authenticated
  USING (
    public.current_user_role() = ANY (
      ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role]
    )
  )
  WITH CHECK (
    public.current_user_role() = ANY (
      ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role]
    )
  );

CREATE POLICY "Client can see own documents"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (client_id = public.current_client_id());

CREATE POLICY "Client can upload own documents"
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = public.current_client_id());
