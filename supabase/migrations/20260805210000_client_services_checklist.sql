-- Client Services checklist phase for the admin/services Priority board.
--
-- The existing onboarding rows stay exactly as they are. Four trigger functions
-- (handle_poa_upload, handle_collection_letter_upload, the two FedEx delivered
-- variants) find their rows with `item ILIKE '%poa%'`, `'%collection letter%'`,
-- and `'%welcome packet%'`, so `item` text is load-bearing and is not rewritten
-- here. `item_key` is added alongside it as a stable identifier so application
-- code can stop matching on labels.
--
-- Overlap note: "POA on File" below does match `item ILIKE '%poa%'`, so
-- handle_poa_upload can also complete it. That is intended -- the item is meant
-- to reflect POA state. Any future client_services item must avoid the three
-- patterns above unless the same coupling is wanted.

ALTER TABLE onboarding_checklist
  ADD COLUMN IF NOT EXISTS item_key TEXT,
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'onboarding';

COMMENT ON COLUMN onboarding_checklist.item_key IS
  'Stable identifier for the item. Preferred over matching on `item` text.';
COMMENT ON COLUMN onboarding_checklist.phase IS
  'Which checklist this row belongs to: onboarding (legacy, trigger-driven) or client_services (Priority board).';

-- ============================================================
-- item_key derivation
-- ============================================================
-- Single source of truth for label -> key, shared by the backfill below and the
-- insert trigger at the bottom of this file. The welcome-packet branch must stay
-- ahead of the POA branch: the legacy 'Send Welcome Packet + POA' label matches
-- both, and it is a welcome-packet row.

CREATE OR REPLACE FUNCTION public.onboarding_checklist_derive_item_key(p_item TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_item IS NULL THEN NULL
    WHEN p_item ILIKE '%collection letter%' THEN 'collection_letter_received'
    WHEN p_item ILIKE '%welcome packet%'
      OR p_item IN ('Send Account Manager', 'Send to Account Manager')
      THEN 'welcome_packet_sent'
    WHEN p_item ILIKE '%poa%' THEN 'poa_received'
    WHEN p_item ILIKE '%charge cc%' THEN 'charge_cc_information'
    ELSE NULL
  END;
$$;

-- ============================================================
-- Backfill item_key for legacy rows
-- ============================================================
-- Historic label churn means a client can hold more than one row for the same
-- logical step: 20260513200000 renamed 'Send Welcome Packet + POA' to
-- 'Send Account Manager', while ensureChecklistItems() inserts
-- 'Send Welcome Packet'. 155 clients currently hold both, so a naive backfill
-- would violate the index below. Only one row per (client, key) gets the key --
-- the completed or bypassed one first, then the oldest. Losers keep item_key
-- NULL, which the unique index tolerates: Postgres treats NULLs as distinct, so
-- any number of unkeyed rows can coexist for the same client.
--
-- Rows created after this migration are keyed by the insert trigger at the
-- bottom of this file, so the column does not decay into a one-time snapshot.

WITH keyed AS (
  SELECT
    id,
    client_id,
    COALESCE(completed, false) OR COALESCE(bypassed, false) AS is_resolved,
    created_at,
    public.onboarding_checklist_derive_item_key(item) AS computed_key
  FROM onboarding_checklist
  WHERE phase = 'onboarding'
),
ranked AS (
  SELECT
    id,
    computed_key,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, computed_key
      ORDER BY is_resolved DESC, created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM keyed
  WHERE computed_key IS NOT NULL
)
UPDATE onboarding_checklist oc
SET item_key = ranked.computed_key
FROM ranked
WHERE oc.id = ranked.id
  AND ranked.rn = 1;

-- Deliberately not a partial index. A partial index cannot be inferred by
-- PostgREST's on_conflict, which the app relies on to upsert checklist rows.
-- NULLS DISTINCT gives the same effect for unkeyed legacy rows.
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_checklist_client_item_key_uniq
  ON onboarding_checklist (client_id, item_key);

CREATE INDEX IF NOT EXISTS onboarding_checklist_phase_client_idx
  ON onboarding_checklist (phase, client_id);

-- ============================================================
-- Seed the client_services phase
-- ============================================================
-- Five items, in workflow order. Ongoing seeding for clients who reach Client
-- Services later is handled by ensureCsChecklistItems() in application code.

INSERT INTO onboarding_checklist (client_id, item, item_key, phase)
SELECT c.id, v.item, v.item_key, 'client_services'
FROM clients c
CROSS JOIN (
  VALUES
    ('CS Intro', 'cs_intro'),
    ('Tracking Update', 'tracking_update'),
    ('Packet Update', 'packet_update'),
    ('POA on File', 'poa_on_file'),
    ('1 Month Followup', 'one_month_followup')
) AS v(item, item_key)
WHERE c.stage = 'client_services'
  AND c.is_active = true
ON CONFLICT (client_id, item_key) DO NOTHING;

-- ============================================================
-- INSERT policy
-- ============================================================
-- onboarding_checklist had SELECT and UPDATE policies but no INSERT policy, so
-- ensureChecklistItems() inserts were silently rejected for non-service-role
-- callers. Staff who can already update every row can create rows too.

DROP POLICY IF EXISTS "Staff insert checklists" ON onboarding_checklist;
CREATE POLICY "Staff insert checklists"
  ON onboarding_checklist FOR INSERT
  WITH CHECK (
    current_user_role() IN ('dev', 'admin', 'acct_manager')
  );

-- ============================================================
-- Keep item_key populated going forward
-- ============================================================
-- Without this, item_key is a one-time snapshot: create_default_checklist() and
-- ensureChecklistItems() both insert `item` only, so every client created after
-- this migration would have NULL keys and the column could never be trusted.
--
-- The trigger never fails an insert that would previously have succeeded. A
-- client can legitimately hold two rows for one logical step (historic label
-- churn produced aliases like 'Send Welcome Packet + POA' vs
-- 'Send Welcome Packet'), and claiming an already-taken key would violate
-- onboarding_checklist_client_item_key_uniq. In that case the row is left
-- unkeyed, exactly like the backfill's losing rows.
--
-- SECURITY DEFINER so the collision check sees every row for the client: an
-- RLS-hidden sibling would otherwise look absent and the insert would fail.

CREATE OR REPLACE FUNCTION public.onboarding_checklist_set_item_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  derived TEXT;
BEGIN
  IF NEW.item_key IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- The derive map covers legacy onboarding labels only. Without this guard the
  -- client_services item 'POA on File' would match the '%poa%' branch and be
  -- keyed 'poa_received' instead of 'poa_on_file'. Board code always supplies
  -- item_key explicitly, so this is belt-and-braces.
  IF NEW.phase IS DISTINCT FROM 'onboarding' THEN
    RETURN NEW;
  END IF;

  derived := public.onboarding_checklist_derive_item_key(NEW.item);

  IF derived IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM onboarding_checklist
    WHERE client_id = NEW.client_id
      AND item_key = derived
  ) THEN
    RETURN NEW;
  END IF;

  NEW.item_key := derived;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_checklist_set_item_key_trg ON onboarding_checklist;
CREATE TRIGGER onboarding_checklist_set_item_key_trg
  BEFORE INSERT ON onboarding_checklist
  FOR EACH ROW
  EXECUTE FUNCTION public.onboarding_checklist_set_item_key();
