-- Packet Manager: tab (status) vs live FedEx/PostLogic scan (carrier_status).
-- One field used to mean both; poll copied "In Transit" onto Delivered-tab rows
-- and they reappeared on Packets Sent.

ALTER TABLE client_fedex_shipments
  ADD COLUMN IF NOT EXISTS carrier_status text;

COMMENT ON COLUMN client_fedex_shipments.status IS
  'Packet Manager tab: Pending | Processing | Delivered | Archived';
COMMENT ON COLUMN client_fedex_shipments.carrier_status IS
  'Printer/FedEx scan only; does not choose the tab';

-- Newest non-pending, non-archived batch is the current Sent cycle.
WITH latest AS (
  SELECT MAX(batch_id) AS batch_id
  FROM client_fedex_shipments
  WHERE status IS DISTINCT FROM 'Pending'
    AND status IS DISTINCT FROM 'Archived'
    AND NULLIF(BTRIM(batch_id), '') IS NOT NULL
)
UPDATE client_fedex_shipments s
SET
  carrier_status = CASE
    WHEN s.status IN (
      'Processing',
      'Sent',
      'Production',
      'In Transit',
      'Out for Delivery',
      'Delivered',
      'Returned',
      'Label Created'
    ) THEN s.status
    WHEN s.status = 'Delivered' AND s.tracking_number IS NOT NULL THEN 'Delivered'
    ELSE s.carrier_status
  END,
  status = CASE
    WHEN s.status = 'Pending' THEN 'Pending'
    WHEN s.status IN ('Archived') THEN 'Archived'
    WHEN s.status IN ('Delivered') THEN 'Delivered'
    WHEN s.status IN ('Processing', 'Sent', 'Production') THEN 'Processing'
    WHEN s.status IN ('In Transit', 'Out for Delivery') THEN
      CASE
        WHEN s.batch_id IS NOT NULL AND s.batch_id = (SELECT batch_id FROM latest)
          THEN 'Processing'
        ELSE 'Delivered'
      END
    ELSE 'Delivered'
  END
WHERE s.status IS DISTINCT FROM 'Pending';

UPDATE client_fedex_shipments
SET carrier_status = NULL
WHERE status = 'Pending';
