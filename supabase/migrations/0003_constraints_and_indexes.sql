-- Primary keys, foreign keys, unique constraints and indexes
--
-- Golden Pathway baseline. Generated once from a verified database, then
-- maintained by hand. See docs/golden-pathway-plan.md section 7.4.
ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attorney_batch_clients
    ADD CONSTRAINT attorney_batch_clients_batch_id_client_id_key UNIQUE (batch_id, client_id);

ALTER TABLE ONLY public.attorney_batch_clients
    ADD CONSTRAINT attorney_batch_clients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attorney_batch_documents
    ADD CONSTRAINT attorney_batch_documents_batch_id_document_id_key UNIQUE (batch_id, document_id);

ALTER TABLE ONLY public.attorney_batch_documents
    ADD CONSTRAINT attorney_batch_documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attorney_batches
    ADD CONSTRAINT attorney_batches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cancellation_logs
    ADD CONSTRAINT cancellation_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.chat_read_receipts
    ADD CONSTRAINT chat_read_receipts_pkey PRIMARY KEY (user_id, channel_id);

ALTER TABLE ONLY public.client_cards
    ADD CONSTRAINT client_cards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_profile_notes
    ADD CONSTRAINT client_profile_notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_reminders
    ADD CONSTRAINT client_reminders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.comm_templates
    ADD CONSTRAINT comm_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.crm_settings
    ADD CONSTRAINT crm_settings_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_resend_message_id_key UNIQUE (resend_message_id);

ALTER TABLE ONLY public.email_message_template_history
    ADD CONSTRAINT email_message_template_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_message_templates
    ADD CONSTRAINT email_message_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_message_templates
    ADD CONSTRAINT email_message_templates_template_key_key UNIQUE (template_key);

ALTER TABLE ONLY public.email_sequence_steps
    ADD CONSTRAINT email_sequence_steps_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_sequence_steps
    ADD CONSTRAINT email_sequence_steps_sequence_id_step_order_key UNIQUE (sequence_id, step_order);

ALTER TABLE ONLY public.email_sequences
    ADD CONSTRAINT email_sequences_key_key UNIQUE (key);

ALTER TABLE ONLY public.email_sequences
    ADD CONSTRAINT email_sequences_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.esign_events
    ADD CONSTRAINT esign_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.esign_layouts
    ADD CONSTRAINT esign_layouts_pkey PRIMARY KEY (kind);

ALTER TABLE ONLY public.esign_requests
    ADD CONSTRAINT esign_requests_opensign_document_id_key UNIQUE (opensign_document_id);

ALTER TABLE ONLY public.esign_requests
    ADD CONSTRAINT esign_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.onboarding_checklist
    ADD CONSTRAINT onboarding_checklist_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.portal_messages
    ADD CONSTRAINT portal_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reminder_templates
    ADD CONSTRAINT reminder_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sequence_enrollments
    ADD CONSTRAINT sequence_enrollments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.staff_email_queue
    ADD CONSTRAINT staff_email_queue_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);

CREATE INDEX announcements_created_at_idx ON public.announcements USING btree (created_at DESC);

CREATE UNIQUE INDEX chat_channels_direct_pair_uniq ON public.chat_channels USING btree (LEAST(participant_1, participant_2), GREATEST(participant_1, participant_2)) WHERE ((type = 'direct'::text) AND (participant_1 IS NOT NULL) AND (participant_2 IS NOT NULL));

CREATE INDEX chat_channels_participant_1_idx ON public.chat_channels USING btree (participant_1) WHERE (type = 'direct'::text);

CREATE INDEX chat_channels_participant_2_idx ON public.chat_channels USING btree (participant_2) WHERE (type = 'direct'::text);

CREATE INDEX chat_messages_channel_created_idx ON public.chat_messages USING btree (channel_id, created_at DESC);

CREATE INDEX email_message_templates_category_seq_step_idx ON public.email_message_templates USING btree (category, sequence_key, step_order);

CREATE INDEX email_message_templates_is_overridden_idx ON public.email_message_templates USING btree (is_overridden) WHERE (is_overridden = true);

CREATE INDEX esign_events_request_idx ON public.esign_events USING btree (request_id, created_at);

CREATE INDEX esign_requests_client_kind_sent_idx ON public.esign_requests USING btree (client_id, kind, sent_at DESC);

CREATE UNIQUE INDEX esign_requests_sign_token_uidx ON public.esign_requests USING btree (sign_token) WHERE (sign_token IS NOT NULL);

CREATE INDEX idx_attorney_batch_clients_client ON public.attorney_batch_clients USING btree (client_id);

CREATE INDEX idx_attorney_batch_documents_batch ON public.attorney_batch_documents USING btree (batch_id);

CREATE INDEX idx_attorney_batch_documents_document ON public.attorney_batch_documents USING btree (document_id);

CREATE UNIQUE INDEX idx_attorney_batches_access_token ON public.attorney_batches USING btree (access_token);

CREATE INDEX idx_attorney_batches_sent_at ON public.attorney_batches USING btree (sent_at DESC);

CREATE INDEX idx_audit_log_action_created_at ON public.audit_log USING btree (action, created_at);

CREATE INDEX idx_audit_log_client_id ON public.audit_log USING btree (client_id);

CREATE INDEX idx_cancellation_logs_client_id ON public.cancellation_logs USING btree (client_id);

CREATE INDEX idx_cancellation_logs_created_at ON public.cancellation_logs USING btree (created_at DESC);

CREATE INDEX idx_chat_dm_participants ON public.chat_channels USING btree (participant_1, participant_2) WHERE (type = 'direct'::text);

CREATE INDEX idx_client_cards_collection_letter_doc_id ON public.client_cards USING btree (collection_letter_doc_id);

CREATE INDEX idx_client_profile_notes_client_created ON public.client_profile_notes USING btree (client_id, created_at DESC);

CREATE INDEX idx_client_reminders_due_at_open ON public.client_reminders USING btree (due_at) WHERE ((completed_at IS NULL) AND (triggered_email_log_id IS NULL));

CREATE INDEX idx_clients_active_client_services ON public.clients USING btree (created_at) WHERE ((is_active = true) AND (stage = 'client_services'::public.case_stage));

CREATE INDEX idx_clients_active_pipeline_created ON public.clients USING btree (created_at DESC) WHERE ((is_active = true) AND (stage <> ALL (ARRAY['dnc'::public.case_stage, 'not_interested'::public.case_stage, 'dnq'::public.case_stage, 'mortgage'::public.case_stage, 'closed'::public.case_stage])));

CREATE INDEX idx_clients_assigned_created ON public.clients USING btree (assigned_to, created_at DESC);

CREATE INDEX idx_clients_assigned_services ON public.clients USING btree (assigned_services_id) WHERE (assigned_services_id IS NOT NULL);

CREATE INDEX idx_clients_assigned_services_id ON public.clients USING btree (assigned_services_id);

CREATE INDEX idx_clients_assigned_to ON public.clients USING btree (assigned_to);

CREATE INDEX idx_clients_attorney_id ON public.clients USING btree (attorney_id);

CREATE INDEX idx_clients_attorney_portal_assigned_at ON public.clients USING btree (attorney_portal_assigned_at DESC NULLS LAST) WHERE (attorney_portal_assigned_at IS NOT NULL);

CREATE INDEX idx_clients_created_at_desc ON public.clients USING btree (created_at DESC);

CREATE INDEX idx_clients_inactive_created ON public.clients USING btree (created_at DESC) WHERE (is_active = false);

CREATE INDEX idx_clients_is_active ON public.clients USING btree (is_active) WHERE (is_active = true);

CREATE INDEX idx_clients_last_first_name ON public.clients USING btree (last_name, first_name);

CREATE UNIQUE INDEX idx_clients_portal_invite_token ON public.clients USING btree (portal_invite_token) WHERE (portal_invite_token IS NOT NULL);

CREATE INDEX idx_clients_stage ON public.clients USING btree (stage);

CREATE INDEX idx_clients_status_changed ON public.clients USING btree (status, status_changed_at);

CREATE INDEX idx_clients_sub_status ON public.clients USING btree (sub_status) WHERE (sub_status IS NOT NULL);

CREATE UNIQUE INDEX idx_comm_templates_sequence_step ON public.comm_templates USING btree (sequence_key, step_order) WHERE (sequence_key IS NOT NULL);

CREATE INDEX idx_comm_templates_type ON public.comm_templates USING btree (template_type);

CREATE INDEX idx_communications_client_id ON public.communications USING btree (client_id);

CREATE INDEX idx_communications_pinned ON public.communications USING btree (client_id, is_pinned) WHERE (is_pinned = true);

CREATE INDEX idx_documents_client_id ON public.documents USING btree (client_id);

CREATE INDEX idx_documents_is_collection_letter ON public.documents USING btree (is_collection_letter);

CREATE INDEX idx_email_logs_client_id_sent_at_desc ON public.email_logs USING btree (client_id, sent_at DESC);

CREATE INDEX idx_email_logs_enrollment_id_sent_at_desc ON public.email_logs USING btree (enrollment_id, sent_at DESC);

CREATE INDEX idx_email_logs_resend_message_id ON public.email_logs USING btree (resend_message_id);

CREATE INDEX idx_email_logs_template_key_sent_at_desc ON public.email_logs USING btree (template_key, sent_at DESC);

CREATE INDEX idx_portal_messages_client_id ON public.portal_messages USING btree (client_id);

CREATE INDEX idx_refunds_client_id ON public.refunds USING btree (client_id);

CREATE INDEX idx_refunds_processor_status ON public.refunds USING btree (processor_mid, status);

CREATE INDEX idx_refunds_status_requested_at ON public.refunds USING btree (status, requested_at DESC);

CREATE INDEX idx_reminder_templates_stage_active ON public.reminder_templates USING btree (stage) WHERE (is_active = true);

CREATE INDEX idx_reminders_assigned_to ON public.reminders USING btree (assigned_to);

CREATE INDEX idx_reminders_assignee_completed_due ON public.reminders USING btree (assigned_to, completed, due_date);

CREATE INDEX idx_reminders_client_completed ON public.reminders USING btree (client_id, completed);

CREATE INDEX idx_reminders_completed_cancelled_due ON public.reminders USING btree (completed, cancelled, due_date);

CREATE INDEX idx_reminders_due_date_completed ON public.reminders USING btree (due_date, completed);

CREATE INDEX idx_sequence_enrollments_active_next_send ON public.sequence_enrollments USING btree (next_send_at) WHERE (status = 'active'::text);

CREATE INDEX idx_sequence_enrollments_client_id ON public.sequence_enrollments USING btree (client_id);

CREATE INDEX idx_sequence_enrollments_client_sequence_key ON public.sequence_enrollments USING btree (client_id, sequence_key);

CREATE INDEX idx_sequence_enrollments_status_enrolled_at ON public.sequence_enrollments USING btree (status, enrolled_at);

CREATE INDEX idx_sequence_enrollments_status_next_send_at ON public.sequence_enrollments USING btree (status, next_send_at) WHERE (status = 'active'::text);

CREATE INDEX idx_staff_email_queue_pending ON public.staff_email_queue USING btree (scheduled_at) WHERE (status = 'pending'::text);

CREATE INDEX notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at DESC);

CREATE INDEX notifications_user_id_read_idx ON public.notifications USING btree (user_id, read);

CREATE UNIQUE INDEX onboarding_checklist_client_item_key_uniq ON public.onboarding_checklist USING btree (client_id, item_key);

CREATE INDEX onboarding_checklist_phase_client_idx ON public.onboarding_checklist USING btree (phase, client_id);

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.attorney_batch_clients
    ADD CONSTRAINT attorney_batch_clients_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.attorney_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attorney_batch_clients
    ADD CONSTRAINT attorney_batch_clients_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attorney_batch_documents
    ADD CONSTRAINT attorney_batch_documents_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.attorney_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attorney_batch_documents
    ADD CONSTRAINT attorney_batch_documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attorney_batch_documents
    ADD CONSTRAINT attorney_batch_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attorney_batches
    ADD CONSTRAINT attorney_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.cancellation_logs
    ADD CONSTRAINT cancellation_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cancellation_logs
    ADD CONSTRAINT cancellation_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_participant_1_fkey FOREIGN KEY (participant_1) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_participant_2_fkey FOREIGN KEY (participant_2) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chat_read_receipts
    ADD CONSTRAINT chat_read_receipts_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chat_read_receipts
    ADD CONSTRAINT chat_read_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_cards
    ADD CONSTRAINT client_cards_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.client_cards
    ADD CONSTRAINT client_cards_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_cards
    ADD CONSTRAINT client_cards_collection_letter_doc_id_fkey FOREIGN KEY (collection_letter_doc_id) REFERENCES public.documents(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.client_profile_notes
    ADD CONSTRAINT client_profile_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_profile_notes
    ADD CONSTRAINT client_profile_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.client_reminders
    ADD CONSTRAINT client_reminders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_reminders
    ADD CONSTRAINT client_reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.client_reminders
    ADD CONSTRAINT client_reminders_triggered_email_log_id_fkey FOREIGN KEY (triggered_email_log_id) REFERENCES public.email_logs(id);

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_assigned_services_id_fkey FOREIGN KEY (assigned_services_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_attorney_id_fkey FOREIGN KEY (attorney_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_attorney_portal_assigned_by_fkey FOREIGN KEY (attorney_portal_assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.comm_templates
    ADD CONSTRAINT comm_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.crm_settings
    ADD CONSTRAINT crm_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.email_sequence_steps(id);

ALTER TABLE ONLY public.email_message_template_history
    ADD CONSTRAINT email_message_template_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.email_message_template_history
    ADD CONSTRAINT email_message_template_history_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_message_templates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_message_templates
    ADD CONSTRAINT email_message_templates_last_edited_by_fkey FOREIGN KEY (last_edited_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.email_sequence_steps
    ADD CONSTRAINT email_sequence_steps_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.email_sequences(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.esign_events
    ADD CONSTRAINT esign_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.esign_requests(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.esign_layouts
    ADD CONSTRAINT esign_layouts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.esign_requests
    ADD CONSTRAINT esign_requests_certificate_document_id_fkey FOREIGN KEY (certificate_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.esign_requests
    ADD CONSTRAINT esign_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.esign_requests
    ADD CONSTRAINT esign_requests_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.esign_requests
    ADD CONSTRAINT esign_requests_signed_document_id_fkey FOREIGN KEY (signed_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT fk_profiles_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.onboarding_checklist
    ADD CONSTRAINT onboarding_checklist_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.onboarding_checklist
    ADD CONSTRAINT onboarding_checklist_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.portal_messages
    ADD CONSTRAINT portal_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.portal_messages
    ADD CONSTRAINT portal_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_from_template_id_fkey FOREIGN KEY (from_template_id) REFERENCES public.reminder_templates(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.sequence_enrollments
    ADD CONSTRAINT sequence_enrollments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.staff_email_queue
    ADD CONSTRAINT staff_email_queue_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
