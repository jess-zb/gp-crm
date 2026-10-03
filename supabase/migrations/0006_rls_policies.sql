-- Row Level Security — the security boundary for this CRM
--
-- Golden Pathway baseline. Generated once from a verified database, then
-- maintained by hand. See docs/golden-pathway-plan.md section 7.4.
CREATE POLICY "Acct manager can update non-leadership profiles" ON public.profiles FOR UPDATE USING (((public.current_user_role() = 'acct_manager'::public.user_role) AND (role <> ALL (ARRAY['dev'::public.user_role, 'admin'::public.user_role])))) WITH CHECK (((public.current_user_role() = 'acct_manager'::public.user_role) AND (role <> ALL (ARRAY['dev'::public.user_role, 'admin'::public.user_role]))));

CREATE POLICY "Acct manager update cards" ON public.client_cards FOR UPDATE USING ((public.current_user_role() = 'acct_manager'::public.user_role)) WITH CHECK ((public.current_user_role() = 'acct_manager'::public.user_role));

CREATE POLICY "Acct manager view email_logs" ON public.email_logs FOR SELECT USING (((public.current_user_role() = 'acct_manager'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.assigned_to = auth.uid())))));

CREATE POLICY "Acct manager view sequence_enrollments" ON public.sequence_enrollments FOR SELECT USING (((public.current_user_role() = 'acct_manager'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.assigned_to = auth.uid())))));

CREATE POLICY "Admin manage email_logs" ON public.email_logs USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'manager'::public.user_role])));

CREATE POLICY "Admin manage email_sequence_steps" ON public.email_sequence_steps USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'manager'::public.user_role])));

CREATE POLICY "Admin manage email_sequences" ON public.email_sequences USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'manager'::public.user_role])));

CREATE POLICY "Admin manage sequence_enrollments" ON public.sequence_enrollments USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'manager'::public.user_role])));

CREATE POLICY "All can read settings" ON public.crm_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Attorney can insert audit for their cases" ON public.audit_log FOR INSERT WITH CHECK (((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE ((clients.attorney_id = auth.uid()) AND (clients.attorney_portal_assigned_at IS NOT NULL) AND (clients.stage = ANY (ARRAY['case_sent_to_attorneys'::public.case_stage, 'closed'::public.case_stage])))))));

CREATE POLICY "Attorney can update assigned case stages" ON public.clients FOR UPDATE USING (((public.current_user_role() = 'attorney'::public.user_role) AND (attorney_id = auth.uid()) AND (attorney_portal_assigned_at IS NOT NULL) AND (stage = ANY (ARRAY['case_sent_to_attorneys'::public.case_stage, 'closed'::public.case_stage])))) WITH CHECK (((public.current_user_role() = 'attorney'::public.user_role) AND (attorney_id = auth.uid()) AND (attorney_portal_assigned_at IS NOT NULL) AND (stage = ANY (ARRAY['case_sent_to_attorneys'::public.case_stage, 'closed'::public.case_stage]))));

CREATE POLICY "Attorney can view client_reminders for their clients" ON public.client_reminders FOR SELECT USING (((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.attorney_id = auth.uid())))));

CREATE POLICY "Attorney can view email_logs for their clients" ON public.email_logs FOR SELECT USING (((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.attorney_id = auth.uid())))));

CREATE POLICY "Attorney can view email_sequence_steps for their clients" ON public.email_sequence_steps FOR SELECT USING (((public.current_user_role() = 'attorney'::public.user_role) AND (EXISTS ( SELECT 1
   FROM ((public.sequence_enrollments e
     JOIN public.clients c ON ((c.id = e.client_id)))
     JOIN public.email_sequences s ON ((s.key = e.sequence_key)))
  WHERE ((s.id = email_sequence_steps.sequence_id) AND (c.attorney_id = auth.uid()))))));

CREATE POLICY "Attorney can view email_sequences for their clients" ON public.email_sequences FOR SELECT USING (((public.current_user_role() = 'attorney'::public.user_role) AND (EXISTS ( SELECT 1
   FROM (public.sequence_enrollments e
     JOIN public.clients c ON ((c.id = e.client_id)))
  WHERE ((e.sequence_key = email_sequences.key) AND (c.attorney_id = auth.uid()))))));

CREATE POLICY "Attorney can view sequence_enrollments for their clients" ON public.sequence_enrollments FOR SELECT USING (((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.attorney_id = auth.uid())))));

CREATE POLICY "Attorney insert client profile notes" ON public.client_profile_notes FOR INSERT WITH CHECK (((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.attorney_id = auth.uid()))) AND (created_by = auth.uid())));

CREATE POLICY "Attorney read client profile notes" ON public.client_profile_notes FOR SELECT USING (((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.attorney_id = auth.uid())))));

CREATE POLICY "Attorney sees assigned cases" ON public.clients FOR SELECT USING (((public.current_user_role() = 'attorney'::public.user_role) AND (attorney_id = auth.uid()) AND (attorney_portal_assigned_at IS NOT NULL) AND (stage = ANY (ARRAY['case_sent_to_attorneys'::public.case_stage, 'closed'::public.case_stage]))));

CREATE POLICY "Attorney sees audit for their cases" ON public.audit_log FOR SELECT USING (((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE ((clients.attorney_id = auth.uid()) AND (clients.attorney_portal_assigned_at IS NOT NULL) AND (clients.stage = ANY (ARRAY['case_sent_to_attorneys'::public.case_stage, 'closed'::public.case_stage])))))));

CREATE POLICY "Attorney sees comms for their cases" ON public.communications FOR SELECT USING (((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE ((clients.attorney_id = auth.uid()) AND (clients.attorney_portal_assigned_at IS NOT NULL) AND (clients.stage = ANY (ARRAY['case_sent_to_attorneys'::public.case_stage, 'closed'::public.case_stage])))))));

CREATE POLICY "Attorney sees documents for their cases" ON public.documents FOR SELECT USING (((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE ((clients.attorney_id = auth.uid()) AND (clients.attorney_portal_assigned_at IS NOT NULL) AND (clients.stage = ANY (ARRAY['case_sent_to_attorneys'::public.case_stage, 'closed'::public.case_stage])))))));

CREATE POLICY "Authenticated users can insert reminders" ON public.reminders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "CRM staff manage attorney_batch_clients" ON public.attorney_batch_clients TO authenticated USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "CRM staff manage attorney_batch_documents" ON public.attorney_batch_documents TO authenticated USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "CRM staff manage attorney_batches" ON public.attorney_batches TO authenticated USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "CRM staff read announcements" ON public.announcements FOR SELECT TO authenticated USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role, 'attorney'::public.user_role, 'manager'::public.user_role, 'sales'::public.user_role, 'service'::public.user_role])));

CREATE POLICY "Can send portal messages" ON public.portal_messages FOR INSERT WITH CHECK (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])) OR ((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE ((clients.attorney_id = auth.uid()) AND (clients.attorney_portal_assigned_at IS NOT NULL) AND (clients.stage = ANY (ARRAY['case_sent_to_attorneys'::public.case_stage, 'closed'::public.case_stage])))))) OR (client_id = public.current_client_id())));

CREATE POLICY "Client sees own record" ON public.clients FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'client'::public.user_role) AND (clients.email IS NOT NULL) AND (p.email IS NOT NULL) AND (lower(TRIM(BOTH FROM clients.email)) = lower(TRIM(BOTH FROM p.email)))))));

CREATE POLICY "Dev admin delete cards" ON public.client_cards FOR DELETE USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Dev admin insert cards" ON public.client_cards FOR INSERT WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Dev admin manage reminder_templates" ON public.reminder_templates USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Dev admin update cards" ON public.client_cards FOR UPDATE USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Dev and admin insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Dev and admin insert template history" ON public.email_message_template_history FOR INSERT WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Dev and admin manage email templates" ON public.email_message_templates USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Dev and admin manage profiles" ON public.profiles USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Dev and admin view template history" ON public.email_message_template_history FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Dev can update settings" ON public.crm_settings TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'dev'::public.user_role))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'dev'::public.user_role)))));

CREATE POLICY "Leadership can delete refunds" ON public.refunds FOR DELETE USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Leadership can settle refunds" ON public.refunds FOR UPDATE USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Leadership can view all profiles" ON public.profiles FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Leadership insert client profile notes" ON public.client_profile_notes FOR INSERT WITH CHECK (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])) AND (created_by = auth.uid())));

CREATE POLICY "Leadership inserts audit log" ON public.audit_log FOR INSERT WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Leadership manages cards" ON public.client_cards USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Leadership manages client_reminders" ON public.client_reminders USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Leadership manages comm templates" ON public.comm_templates USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Leadership manages email_logs" ON public.email_logs USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Leadership manages email_sequence_steps" ON public.email_sequence_steps USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Leadership manages email_sequences" ON public.email_sequences USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Leadership manages sequence_enrollments" ON public.sequence_enrollments USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])));

CREATE POLICY "Leadership read client profile notes" ON public.client_profile_notes FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Leadership see all comms" ON public.communications USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Leadership sees audit log" ON public.audit_log FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Leadership select cards" ON public.client_cards FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Service role manages staff_email_queue" ON public.staff_email_queue TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Staff can delete reminders" ON public.reminders FOR DELETE USING (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])) OR ((public.current_user_role() = 'acct_manager'::public.user_role) AND (assigned_to = auth.uid()))));

CREATE POLICY "Staff can insert cancellation logs for accessible clients" ON public.cancellation_logs FOR INSERT WITH CHECK (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])) OR ((public.current_user_role() = ANY (ARRAY['sales'::public.user_role, 'service'::public.user_role])) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.assigned_to = auth.uid()))))));

CREATE POLICY "Staff can insert reminders" ON public.reminders FOR INSERT WITH CHECK (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])) OR (assigned_to = auth.uid())));

CREATE POLICY "Staff can read cancellation logs for accessible clients" ON public.cancellation_logs FOR SELECT USING (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role, 'manager'::public.user_role])) OR ((public.current_user_role() = ANY (ARRAY['sales'::public.user_role, 'service'::public.user_role])) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.assigned_to = auth.uid()))))));

CREATE POLICY "Staff can read refunds" ON public.refunds FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Staff can request refunds" ON public.refunds FOR INSERT WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Staff can see and manage reminders" ON public.reminders USING (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])) OR (assigned_to = auth.uid())));

CREATE POLICY "Staff can see checklists" ON public.onboarding_checklist FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Staff can update checklists" ON public.onboarding_checklist FOR UPDATE USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Staff can update reminders" ON public.reminders FOR UPDATE USING (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])) OR ((public.current_user_role() = 'acct_manager'::public.user_role) AND (assigned_to = auth.uid())))) WITH CHECK (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])) OR ((public.current_user_role() = 'acct_manager'::public.user_role) AND (assigned_to = auth.uid()))));

CREATE POLICY "Staff can view reminders" ON public.reminders FOR SELECT USING (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])) OR (assigned_to = auth.uid())));

CREATE POLICY "Staff insert checklists" ON public.onboarding_checklist FOR INSERT WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Staff manage esign_requests" ON public.esign_requests TO authenticated USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Staff read esign_events" ON public.esign_events FOR SELECT TO authenticated USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Staff read esign_layouts" ON public.esign_layouts FOR SELECT TO authenticated USING ((public.current_user_role() = 'dev'::public.user_role));

CREATE POLICY "Staff read reminder_templates" ON public.reminder_templates FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])));

CREATE POLICY "Staff see portal messages" ON public.portal_messages FOR SELECT USING (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])) OR ((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.attorney_id = auth.uid()))))));

CREATE POLICY "Staff see portal messages for clients" ON public.portal_messages FOR SELECT USING (((public.current_user_role() = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role, 'acct_manager'::public.user_role])) OR ((public.current_user_role() = 'attorney'::public.user_role) AND (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE ((clients.attorney_id = auth.uid()) AND (clients.attorney_portal_assigned_at IS NOT NULL) AND (clients.stage = ANY (ARRAY['case_sent_to_attorneys'::public.case_stage, 'closed'::public.case_stage])))))) OR (client_id = public.current_client_id())));

CREATE POLICY "Staff write esign_layouts" ON public.esign_layouts TO authenticated USING ((public.current_user_role() = 'dev'::public.user_role)) WITH CHECK ((public.current_user_role() = 'dev'::public.user_role));

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));

CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attorney_batch_clients ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attorney_batch_documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attorney_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cancellation_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_channels_insert_dm ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (((type = 'direct'::text) AND (participant_1 = auth.uid()) AND (participant_2 IS NOT NULL) AND (participant_2 <> auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = chat_channels.participant_2) AND (p.role <> 'client'::public.user_role))))));

CREATE POLICY chat_channels_select_member ON public.chat_channels FOR SELECT TO authenticated USING (public.can_access_chat_channel(id));

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_delete_own ON public.chat_messages FOR DELETE TO authenticated USING (((sender_id = auth.uid()) AND public.can_access_chat_channel(channel_id)));

CREATE POLICY chat_messages_insert_member ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND public.can_post_chat_channel(channel_id)));

CREATE POLICY chat_messages_insert_own_sender ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.chat_channels c
  WHERE ((c.id = chat_messages.channel_id) AND (((c.type = 'announcement'::text) AND (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])))))) OR ((c.type <> 'announcement'::text) AND ((c.type = 'direct'::text) OR ((c.type = 'department'::text) AND ((c.department IS NULL) OR ((c.department = 'accounts'::text) AND (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND COALESCE(p.is_accounts, false))))) OR ((c.department = 'services'::text) AND (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND COALESCE(p.is_services, false))))) OR (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role])))))))))))))));

CREATE POLICY chat_messages_select_accessible ON public.chat_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.chat_channels c
  WHERE ((c.id = chat_messages.channel_id) AND ((c.type = 'announcement'::text) OR (c.type = 'direct'::text) OR ((c.type = 'department'::text) AND ((c.department IS NULL) OR ((c.department = 'accounts'::text) AND (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND COALESCE(p.is_accounts, false))))) OR ((c.department = 'services'::text) AND (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND COALESCE(p.is_services, false))))) OR (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['dev'::public.user_role, 'admin'::public.user_role]))))))))))));

CREATE POLICY chat_messages_select_member ON public.chat_messages FOR SELECT TO authenticated USING (public.can_access_chat_channel(channel_id));

CREATE POLICY chat_messages_update_own ON public.chat_messages FOR UPDATE TO authenticated USING (((sender_id = auth.uid()) AND public.can_access_chat_channel(channel_id))) WITH CHECK (((sender_id = auth.uid()) AND public.can_access_chat_channel(channel_id)));

ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_read_receipts_delete_own ON public.chat_read_receipts FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY chat_read_receipts_insert_own ON public.chat_read_receipts FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

CREATE POLICY chat_read_receipts_select_own ON public.chat_read_receipts FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY chat_read_receipts_update_own ON public.chat_read_receipts FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.client_cards ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_profile_notes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_reminders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.comm_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_message_template_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_message_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.esign_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.esign_layouts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.esign_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY lock_permanent_client_document_deletes ON public.documents AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT (COALESCE(is_collection_letter, false) OR ((document_type)::text = ANY (ARRAY['collection_letter'::text, 'poa_document'::text, 'poa'::text, 'poa_signed'::text, 'power_of_attorney'::text])))));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.onboarding_checklist ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_delete_leadership ON public.profiles FOR DELETE TO authenticated USING (((public.current_user_role() = 'dev'::public.user_role) OR ((public.current_user_role() = 'admin'::public.user_role) AND (role IS DISTINCT FROM 'dev'::public.user_role))));

CREATE POLICY profiles_insert_leadership ON public.profiles FOR INSERT TO authenticated WITH CHECK (((public.current_user_role() = 'dev'::public.user_role) OR ((public.current_user_role() = 'admin'::public.user_role) AND (role IS DISTINCT FROM 'dev'::public.user_role))));

CREATE POLICY profiles_select_visible ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR (public.current_user_role() = 'dev'::public.user_role) OR (role IS DISTINCT FROM 'dev'::public.user_role)));

CREATE POLICY profiles_update_leadership ON public.profiles FOR UPDATE TO authenticated USING (((public.current_user_role() = 'dev'::public.user_role) OR ((public.current_user_role() = 'admin'::public.user_role) AND (role IS DISTINCT FROM 'dev'::public.user_role)))) WITH CHECK (((public.current_user_role() = 'dev'::public.user_role) OR ((public.current_user_role() = 'admin'::public.user_role) AND (role IS DISTINCT FROM 'dev'::public.user_role))));

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_email_queue ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
