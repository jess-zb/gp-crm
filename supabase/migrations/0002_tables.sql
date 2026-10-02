-- Tables, in dependency order
--
-- Golden Pathway baseline. Generated once from a verified database, then
-- maintained by hand. See docs/golden-pathway-plan.md section 7.4.
CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_by_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.attorney_batch_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    client_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.attorney_batch_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    client_id uuid NOT NULL,
    document_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.attorney_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    access_token text NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT attorney_batches_access_token_hex CHECK ((access_token ~ '^[0-9a-f]{64}$'::text))
);

CREATE TABLE public.audit_log (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid,
    action text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    performed_by uuid,
    performed_by_name text,
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.cancellation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    reason text NOT NULL,
    notes text,
    performed_by uuid,
    performed_by_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.chat_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    department text,
    created_at timestamp with time zone DEFAULT now(),
    participant_1 uuid,
    participant_2 uuid,
    CONSTRAINT chat_channels_type_chk CHECK ((type = ANY (ARRAY['department'::text, 'direct'::text, 'announcement'::text])))
);

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    edited_at timestamp with time zone
);

CREATE TABLE public.chat_read_receipts (
    user_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.client_cards (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    creditor_name text NOT NULL,
    card_type public.card_type NOT NULL,
    last_four character(4) NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    charge_amount_cents integer DEFAULT 0 NOT NULL,
    collection_letter_doc_id uuid,
    merchant_name text,
    authorization_status text DEFAULT 'pre_auth'::text NOT NULL
);

CREATE TABLE public.client_profile_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    body text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.client_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    reminder_type text NOT NULL,
    due_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    triggered_email_log_id uuid,
    created_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    first_name text NOT NULL,
    middle_initial text,
    last_name text NOT NULL,
    nickname text,
    date_of_birth date,
    ssn_encrypted text,
    drivers_license text,
    email text,
    phone text,
    preferred_contact text DEFAULT 'email'::text,
    street_address text,
    city text,
    state text,
    zip_code text,
    stage public.case_stage DEFAULT 'lead'::public.case_stage NOT NULL,
    stage_entered_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_to uuid,
    referred_by text,
    client_notes text,
    call_notes text,
    poa_signed_at timestamp with time zone,
    poa_document_url text,
    collection_letter_received_at timestamp with time zone,
    case_sent_to_attorney_at timestamp with time zone,
    attorney_id uuid,
    is_active boolean DEFAULT true,
    portal_access boolean DEFAULT false,
    notifications_enabled boolean DEFAULT true,
    portal_invite_token text,
    portal_invite_sent_at timestamp with time zone,
    portal_password_set boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    spouse_name text,
    spouse_nickname text,
    phone_mobile text,
    phone_work text,
    phone_home text,
    cc_charged_at timestamp with time zone,
    resend_requested_at timestamp with time zone,
    spouse_first_name text,
    spouse_last_name text,
    status public.client_status DEFAULT 'lead'::public.client_status NOT NULL,
    status_changed_at timestamp with time zone DEFAULT now() NOT NULL,
    unsubscribed_at timestamp with time zone,
    verbal_password text,
    qfhp numeric(12,2),
    reviewed_at timestamp with time zone,
    reviewed_by_name text,
    secondary_first_name text,
    dnc_reason text,
    assigned_services_id uuid,
    attorney_portal_assigned_at timestamp with time zone,
    attorney_portal_assigned_by uuid,
    attorney_portal_attorney_name text,
    sub_status text
);

CREATE TABLE public.comm_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    template_type text NOT NULL,
    subject text,
    body text DEFAULT ''::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sequence_key text,
    step_order integer,
    day_offset integer,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT comm_templates_template_type_check CHECK ((template_type = ANY (ARRAY['email'::text, 'text'::text])))
);

CREATE TABLE public.communications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid,
    type public.communication_type NOT NULL,
    direction public.communication_direction NOT NULL,
    subject text,
    body text,
    from_number text,
    to_number text,
    ringcentral_call_id text,
    duration_seconds integer,
    recorded_by uuid,
    sent_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    is_pinned boolean DEFAULT false NOT NULL
);

CREATE TABLE public.crm_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.documents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    document_type public.document_type NOT NULL,
    file_name text NOT NULL,
    storage_path text NOT NULL,
    file_size_bytes integer,
    mime_type text,
    uploaded_by uuid,
    notes text,
    is_collection_letter boolean DEFAULT false,
    attorney_notified_at timestamp with time zone,
    attorney_notify_error text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid,
    step_id uuid,
    client_id uuid,
    template_key text,
    resend_message_id text,
    status text,
    error text,
    sent_at timestamp with time zone DEFAULT now(),
    delivered_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    bounced_at timestamp with time zone,
    sequence_id text,
    step integer,
    subject text,
    CONSTRAINT email_logs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'complained'::text, 'failed'::text])))
);

CREATE TABLE public.email_message_template_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    field text NOT NULL,
    old_value text,
    new_value text
);

CREATE TABLE public.email_message_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_key text NOT NULL,
    name text NOT NULL,
    sequence_key text,
    step_order integer,
    day_offset integer,
    default_subject text NOT NULL,
    default_body text NOT NULL,
    subject_override text,
    body_override text,
    is_overridden boolean DEFAULT false NOT NULL,
    required_variables text[] DEFAULT '{}'::text[],
    category text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_edited_by uuid,
    last_edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.email_sequence_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sequence_id uuid,
    step_order integer NOT NULL,
    day_offset integer NOT NULL,
    template_key text NOT NULL,
    subject text NOT NULL
);

CREATE TABLE public.email_sequences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    trigger_status text,
    trigger_type text NOT NULL,
    cancels_keys text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.esign_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    event text NOT NULL,
    ip text,
    user_agent text,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.esign_layouts (
    kind text NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT esign_layouts_kind_check CHECK ((kind = ANY (ARRAY['cc_authorization'::text, 'welcome_packet'::text])))
);

CREATE TABLE public.esign_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    kind text NOT NULL,
    opensign_document_id text,
    status text NOT NULL,
    signer_email text NOT NULL,
    signer_name text NOT NULL,
    sent_by uuid,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    signed_document_id uuid,
    certificate_document_id uuid,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sign_token text,
    token_expires_at timestamp with time zone,
    viewed_at timestamp with time zone,
    viewed_ip text,
    signed_ip text,
    user_agent text,
    otp_hash text,
    otp_verified_at timestamp with time zone,
    document_sha256 text,
    intent_accepted_at timestamp with time zone,
    cert_ref text,
    prefill_snapshot jsonb,
    CONSTRAINT esign_requests_kind_check CHECK ((kind = ANY (ARRAY['cc_authorization'::text, 'welcome_packet'::text]))),
    CONSTRAINT esign_requests_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'viewed'::text, 'signed'::text, 'completed'::text, 'declined'::text, 'revoked'::text, 'failed'::text, 'superseded'::text])))
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    client_id uuid,
    client_name text,
    read boolean DEFAULT false,
    action_url text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.onboarding_checklist (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    item text NOT NULL,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    completed_by uuid,
    bypassed boolean DEFAULT false,
    bypass_reason text,
    created_at timestamp with time zone DEFAULT now(),
    item_key text,
    phase text DEFAULT 'onboarding'::text NOT NULL
);

CREATE TABLE public.portal_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    sender_name text,
    sender_role public.user_role,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role public.user_role DEFAULT 'client'::public.user_role NOT NULL,
    full_name text,
    email text,
    phone text,
    title text,
    team_id uuid,
    avatar_url text,
    signature_url text,
    is_active boolean DEFAULT true,
    is_default_attorney boolean DEFAULT false NOT NULL,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_accounts boolean DEFAULT false NOT NULL,
    is_services boolean DEFAULT false NOT NULL
);

CREATE TABLE public.refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    amount_cents integer DEFAULT 0 NOT NULL,
    processor_mid text,
    status text DEFAULT 'requested'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    requested_by uuid,
    requested_by_name text,
    refunded_at timestamp with time zone,
    refunded_by uuid,
    refunded_by_name text,
    offset_billed_at timestamp with time zone,
    offset_amount_cents integer,
    notes text,
    needs_review boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT refunds_amount_cents_check CHECK ((amount_cents >= 0)),
    CONSTRAINT refunds_offset_amount_cents_check CHECK (((offset_amount_cents IS NULL) OR (offset_amount_cents >= 0))),
    CONSTRAINT refunds_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'refunded'::text, 'denied'::text])))
);

CREATE TABLE public.reminder_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage text NOT NULL,
    description text NOT NULL,
    hours_after_stage_entry integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    CONSTRAINT reminder_templates_hours_after_stage_entry_check CHECK ((hours_after_stage_entry >= 0))
);

CREATE TABLE public.reminders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid,
    assigned_to uuid,
    description text NOT NULL,
    due_date timestamp with time zone,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    cancelled boolean DEFAULT false NOT NULL,
    auto_generated boolean DEFAULT false NOT NULL,
    from_template_id uuid,
    appointment_type_key text,
    department text,
    workflow_source text,
    origin_stage text,
    appointment_type text,
    pipeline_type text,
    notes text,
    CONSTRAINT reminders_department_check CHECK (((department IS NULL) OR (department = ANY (ARRAY['sales'::text, 'retention'::text, 'service'::text, 'legal'::text])))),
    CONSTRAINT reminders_pipeline_type_check CHECK (((pipeline_type IS NULL) OR (pipeline_type = ANY (ARRAY['sales'::text, 'service'::text]))))
);

CREATE TABLE public.sequence_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    sequence_id text,
    status text DEFAULT 'active'::text,
    enrolled_at timestamp with time zone DEFAULT now(),
    paused_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    last_step_sent integer DEFAULT 0,
    next_send_at timestamp with time zone,
    sequence_key text,
    current_step integer DEFAULT 0,
    skipped_step_orders integer[] DEFAULT '{}'::integer[] NOT NULL,
    CONSTRAINT sequence_enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])))
);

CREATE TABLE public.staff_email_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_key text NOT NULL,
    to_email text NOT NULL,
    recipient_user_id uuid,
    variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    error text,
    resend_message_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_email_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])))
);

CREATE TABLE public.teams (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);
