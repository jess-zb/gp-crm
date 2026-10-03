-- Extensions and enums
--
-- Golden Pathway baseline. Generated once from a verified database, then
-- maintained by hand. See docs/golden-pathway-plan.md section 7.4.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TYPE public.card_type AS ENUM (
    'visa',
    'mastercard',
    'amex',
    'discover',
    'other'
);

CREATE TYPE public.case_stage AS ENUM (
    'lead',
    'client_services',
    'account_manager',
    'awaiting_collection_letter',
    'case_sent_to_attorneys',
    'closed',
    'retention',
    'dnc',
    'not_interested',
    'dnq',
    'mortgage'
);

CREATE TYPE public.client_status AS ENUM (
    'lead',
    'active',
    'case_referred',
    'archived'
);

CREATE TYPE public.communication_direction AS ENUM (
    'inbound',
    'outbound',
    'internal'
);

CREATE TYPE public.communication_type AS ENUM (
    'call',
    'sms',
    'email',
    'note'
);

CREATE TYPE public.document_type AS ENUM (
    'government_id',
    'utility_bill',
    'social_security_card',
    'collection_letter',
    'poa_signed',
    'client_agreement',
    'correspondence',
    'audio_recording',
    'screenshot',
    'other',
    'poa_document',
    'cc_authorization',
    'upload'
);

CREATE TYPE public.user_role AS ENUM (
    'dev',
    'admin',
    'manager',
    'sales',
    'service',
    'attorney',
    'client',
    'acct_manager'
);
