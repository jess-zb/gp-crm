-- Backfill assigned compliance to Alex for active pipeline clients missing one.
-- Requires profile row with email alex@zerobalance.info.

UPDATE clients
SET assigned_compliance_id = (
  SELECT id FROM profiles WHERE email = 'alex@zerobalance.info' LIMIT 1
)
WHERE assigned_compliance_id IS NULL
  AND is_active = true
  AND stage NOT IN (
    'dnc',
    'not_interested',
    'dnq',
    'mortgage',
    'closed',
    'retention'
  );
