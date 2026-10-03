-- Helper functions, RLS predicates and trigger bodies
--
-- Golden Pathway baseline. Generated once from a verified database, then
-- maintained by hand. See docs/golden-pathway-plan.md section 7.4.
CREATE FUNCTION public.can_access_chat_channel(p_channel_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_channels c
    JOIN profiles me ON me.id = auth.uid()
    WHERE c.id = p_channel_id
      AND me.role <> 'client'
      AND (
        c.type = 'announcement'
        OR (
          c.type = 'direct'
          AND (me.id = c.participant_1 OR me.id = c.participant_2)
        )
        OR (
          c.type = 'department'
          AND (
            me.role IN ('dev', 'admin')
            OR c.department IS NULL
            OR (c.department = 'accounts' AND COALESCE(me.is_accounts, false))
            OR (c.department = 'services' AND COALESCE(me.is_services, false))
          )
        )
      )
  );
$$;

CREATE FUNCTION public.can_post_chat_channel(p_channel_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT can_access_chat_channel(p_channel_id)
     AND (
       NOT EXISTS (
         SELECT 1 FROM chat_channels c
         WHERE c.id = p_channel_id AND c.type = 'announcement'
       )
       OR EXISTS (
         SELECT 1 FROM profiles p
         WHERE p.id = auth.uid() AND p.role IN ('dev', 'admin')
       )
     );
$$;

CREATE FUNCTION public.cancel_enrollments_on_client_inactive() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_active = false AND (OLD.is_active IS DISTINCT FROM false) THEN
    UPDATE sequence_enrollments
       SET status = 'cancelled',
           cancelled_at = now(),
           next_send_at = NULL,
           cancel_reason = 'client_inactive'
     WHERE client_id = NEW.id
       AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.create_default_checklist() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO onboarding_checklist (client_id, item) VALUES
    (NEW.id, 'Charge CC Information'),
    (NEW.id, 'Welcome Packet signed'),
    (NEW.id, 'Signed POA Received'),
    (NEW.id, 'Collection Letter Received');
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.crm_client_tab_counts(p_assigned_to uuid DEFAULT NULL::uuid) RETURNS TABLE(all_count bigint, active_count bigint, archives_count bigint, priority_count bigint)
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE created_at >= TIMESTAMPTZ '2026-06-02 00:00:00+00'
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS all_count,
    COUNT(*) FILTER (
      WHERE is_active = true
        AND stage NOT IN ('dnc', 'not_interested', 'dnq', 'mortgage', 'closed')
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS active_count,
    COUNT(*) FILTER (
      WHERE is_active = false
        AND created_at >= TIMESTAMPTZ '2026-06-02 00:00:00+00'
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS archives_count,
    COUNT(*) FILTER (
      WHERE is_active = true
        AND stage = 'client_services'
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS priority_count
  FROM clients;
$$;

CREATE FUNCTION public.current_client_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.id
  FROM clients c
  INNER JOIN profiles p ON p.id = auth.uid()
  WHERE p.role = 'client'
    AND c.email IS NOT NULL
    AND p.email IS NOT NULL
    AND lower(trim(c.email)) = lower(trim(p.email))
  LIMIT 1;
$$;

CREATE FUNCTION public.current_user_role() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE FUNCTION public.handle_client_stage_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  seq   email_sequences%ROWTYPE;
  ckey  text;
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.stage IS DISTINCT FROM OLD.stage) THEN

    FOR seq IN
      SELECT * FROM email_sequences
      WHERE trigger_status = NEW.stage::text
        AND trigger_type = 'status'
        AND is_active = true
    LOOP
      -- Cancel competing active enrollments
      FOREACH ckey IN ARRAY seq.cancels_keys LOOP
        UPDATE sequence_enrollments e
          SET status = 'cancelled', cancelled_at = now(),
              cancel_reason = 'superseded by ' || seq.key,
              next_send_at = NULL
          FROM email_sequences s2
          WHERE e.sequence_id = s2.id::text
            AND s2.key = ckey
            AND e.client_id = NEW.id
            AND e.status = 'active';

        UPDATE sequence_enrollments e
          SET status = 'cancelled', cancelled_at = now(),
              cancel_reason = 'superseded by ' || seq.key,
              next_send_at = NULL
          WHERE e.sequence_key = ckey
            AND e.client_id = NEW.id
            AND e.status = 'active';
      END LOOP;

      -- Enroll (idempotent) — always writes both sequence_id and sequence_key
      INSERT INTO sequence_enrollments (client_id, sequence_id, sequence_key, next_send_at)
      SELECT NEW.id, seq.id, seq.key,
        now() + make_interval(days => COALESCE((
          SELECT st.day_offset::int
          FROM email_sequence_steps st
          WHERE st.sequence_id = seq.id
          ORDER BY st.step_order ASC
          LIMIT 1
        ), 0))
      WHERE NOT EXISTS (
        SELECT 1 FROM sequence_enrollments
        WHERE client_id = NEW.id
          AND (sequence_id = seq.id::text OR sequence_key = seq.key)
          AND status = 'active'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.handle_collection_letter_upload() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  default_attorney_id UUID;
  is_collection_doc BOOLEAN;
BEGIN
  is_collection_doc :=
    COALESCE(NEW.is_collection_letter, false) = true
    OR NEW.document_type::text = 'collection_letter';

  IF is_collection_doc THEN
    UPDATE clients
    SET
      stage = 'case_sent_to_attorneys',
      collection_letter_received_at = NOW(),
      case_sent_to_attorney_at = NOW(),
      stage_entered_at = NOW()
    WHERE id = NEW.client_id
      AND stage NOT IN ('case_sent_to_attorneys', 'closed');

    UPDATE onboarding_checklist
    SET completed = true, completed_at = NOW()
    WHERE client_id = NEW.client_id
      AND item ILIKE '%collection letter%'
      AND completed = false;

    SELECT id INTO default_attorney_id
    FROM profiles
    WHERE role = 'attorney'
      AND is_default_attorney = true
      AND is_active = true
    LIMIT 1;

    IF default_attorney_id IS NOT NULL THEN
      UPDATE clients
      SET attorney_id = default_attorney_id
      WHERE id = NEW.client_id
        AND attorney_id IS NULL;
    END IF;

    INSERT INTO audit_log (client_id, action, new_value, performed_by_name)
    VALUES (
      NEW.client_id,
      'stage_auto_advanced',
      jsonb_build_object(
        'stage', 'case_sent_to_attorneys',
        'trigger', 'collection_letter_upload',
        'document_id', NEW.id
      ),
      'System'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'client')
  );
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.handle_poa_upload() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  advanced int;
  from_stage text;
BEGIN
  IF NEW.document_type::text NOT IN ('poa_document', 'poa_signed') THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO from_stage
  FROM clients
  WHERE id = NEW.client_id;

  UPDATE clients
  SET
    stage = 'awaiting_collection_letter',
    stage_entered_at = NOW()
  WHERE id = NEW.client_id
    AND stage IN ('account_manager', 'client_services');

  GET DIAGNOSTICS advanced = ROW_COUNT;

  IF advanced > 0 THEN
    UPDATE onboarding_checklist
    SET
      completed = true,
      completed_at = NOW()
    WHERE client_id = NEW.client_id
      AND item ILIKE '%poa%'
      AND completed = false;

    INSERT INTO audit_log (client_id, action, new_value, performed_by_name)
    VALUES (
      NEW.client_id,
      'stage_auto_advanced',
      jsonb_build_object(
        'stage', 'awaiting_collection_letter',
        'trigger', 'poa_upload',
        'from_stage', from_stage,
        'document_id', NEW.id
      ),
      'System'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.insert_auto_reminders_from_templates(p_client_id uuid, p_stage text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_assigned UUID;
BEGIN
  SELECT assigned_to INTO v_assigned FROM clients WHERE id = p_client_id;

  INSERT INTO reminders (
    client_id,
    assigned_to,
    description,
    due_date,
    completed,
    created_by,
    auto_generated,
    from_template_id
  )
  SELECT
    p_client_id,
    v_assigned,
    COALESCE(NULLIF(BTRIM(t.title), ''), t.description),
    NOW() + make_interval(hours => t.hours_after_stage_entry),
    false,
    NULL,
    true,
    t.id
  FROM reminder_templates t
  WHERE t.stage = p_stage
    AND t.is_active = true;
END;
$$;

CREATE FUNCTION public.log_template_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.subject_override IS DISTINCT FROM OLD.subject_override THEN
    INSERT INTO email_message_template_history (template_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, NEW.last_edited_by, 'subject', OLD.subject_override, NEW.subject_override);
  END IF;
  IF NEW.body_override IS DISTINCT FROM OLD.body_override THEN
    INSERT INTO email_message_template_history (template_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, NEW.last_edited_by, 'body', OLD.body_override, NEW.body_override);
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.onboarding_checklist_derive_item_key(p_item text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
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

CREATE FUNCTION public.onboarding_checklist_set_item_key() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
