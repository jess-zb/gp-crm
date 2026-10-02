-- Pairs of active clients sharing the same normalized mobile number.
CREATE OR REPLACE VIEW duplicate_client_pairs AS
WITH normalized AS (
  SELECT
    c.id,
    c.phone_mobile,
    regexp_replace(coalesce(c.phone_mobile, ''), '\D', '', 'g') AS phone_digits,
    trim(coalesce(c.first_name, '')) AS first_name,
    trim(coalesce(c.last_name, '')) AS last_name,
    c.stage,
    c.created_at,
    trim(
      concat(
        trim(coalesce(c.first_name, '')),
        ' ',
        trim(coalesce(c.last_name, ''))
      )
    ) AS full_name
  FROM clients c
  WHERE c.phone_mobile IS NOT NULL
    AND trim(c.phone_mobile) <> ''
    AND regexp_replace(coalesce(c.phone_mobile, ''), '\D', '', 'g') <> ''
    AND coalesce(c.is_active, true) = true
),
phone_groups AS (
  SELECT phone_digits, count(*)::int AS record_count
  FROM normalized
  GROUP BY phone_digits
  HAVING count(*) >= 2
),
ranked AS (
  SELECT
    n.*,
    pg.record_count,
    row_number() OVER (
      PARTITION BY n.phone_digits
      ORDER BY n.created_at ASC NULLS LAST, n.id
    ) AS rn
  FROM normalized n
  INNER JOIN phone_groups pg ON pg.phone_digits = n.phone_digits
),
primary_row AS (
  SELECT * FROM ranked WHERE rn = 1
),
secondary_rows AS (
  SELECT * FROM ranked WHERE rn > 1
)
SELECT
  p.phone_mobile,
  p.phone_digits,
  p.id AS primary_id,
  NULLIF(p.full_name, '') AS primary_name,
  p.stage AS primary_stage,
  s.id AS secondary_id,
  NULLIF(s.full_name, '') AS secondary_name,
  s.stage AS secondary_stage,
  p.record_count,
  (
    p.last_name <> ''
    AND s.last_name <> ''
    AND lower(p.last_name) <> lower(s.last_name)
    AND lower(p.last_name) NOT IN ('unknown', 'n/a')
    AND lower(s.last_name) NOT IN ('unknown', 'n/a')
  ) AS is_likely_household
FROM primary_row p
INNER JOIN secondary_rows s ON s.phone_digits = p.phone_digits;

GRANT SELECT ON duplicate_client_pairs TO authenticated;
