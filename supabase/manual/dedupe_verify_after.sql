-- ============================================================================
-- RUN AFTER: dedupe.js + optional unique index on shape_lead_id
-- Sanity checks for duplicate clients and orphan risks.
-- ============================================================================

-- 1) Duplicate shape_lead_id (should be 0 rows after unique partial index + clean data)
SELECT shape_lead_id, COUNT(*) AS n
FROM clients
WHERE shape_lead_id IS NOT NULL
  AND trim(shape_lead_id) <> ''
GROUP BY shape_lead_id
HAVING COUNT(*) > 1;

-- 2) Duplicate normalized emails (informational — merge rules may still allow until cleaned)
SELECT lower(trim(email)) AS email_norm, COUNT(*) AS n
FROM clients
WHERE email IS NOT NULL AND trim(email) <> ''
GROUP BY lower(trim(email))
HAVING COUNT(*) > 1;

-- 3) Rows still named Unknown / Unknown (expect none except intentional placeholders)
SELECT id, shape_lead_id, shape_contact_id, email, phone_mobile, phone, created_at
FROM clients
WHERE lower(trim(first_name)) = 'unknown'
  AND lower(trim(last_name)) = 'unknown'
ORDER BY created_at;

-- 4) FK integrity smoke test — communications pointing at missing client (should be 0)
SELECT c.id
FROM communications c
LEFT JOIN clients cl ON cl.id = c.client_id
WHERE c.client_id IS NOT NULL AND cl.id IS NULL
LIMIT 50;

-- 5) FK integrity — reminders
SELECT r.id
FROM reminders r
LEFT JOIN clients cl ON cl.id = r.client_id
WHERE r.client_id IS NOT NULL AND cl.id IS NULL
LIMIT 50;

-- 6) FK integrity — onboarding_checklist
SELECT o.id
FROM onboarding_checklist o
LEFT JOIN clients cl ON cl.id = o.client_id
WHERE cl.id IS NULL
LIMIT 50;

-- 7) Count clients (compare to pre-run notes / backup row counts)
SELECT COUNT(*) AS client_count FROM clients;
