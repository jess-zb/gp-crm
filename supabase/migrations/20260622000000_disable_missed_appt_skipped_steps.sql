-- ============================================================
-- Disable follow_up_24hr (missed-appointment) emails entirely,
-- cancel in-flight enrollments, and add per-step skip support.
-- Applied to prod 2026-06-22 via Supabase SQL editor.
-- ============================================================

-- 0. Ensure required columns exist before UPDATEs that reference them
ALTER TABLE public.sequence_enrollments
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS skipped_step_orders int[] NOT NULL DEFAULT '{}'::int[];

-- 1. Block NEW enrollments via the stage-change trigger
UPDATE public.email_sequences
   SET is_active = false
 WHERE key = 'follow_up_24hr';

-- 2. Block the dispatcher from picking up follow_up_24hr templates
UPDATE public.comm_templates
   SET is_active = false
 WHERE sequence_key = 'follow_up_24hr';

-- 3. Cancel any in-flight follow_up_24hr enrollments
UPDATE public.sequence_enrollments
   SET status = 'cancelled',
       cancelled_at = now(),
       cancel_reason = 'follow_up_24hr disabled',
       next_send_at = NULL
 WHERE sequence_key = 'follow_up_24hr'
   AND status = 'active';
