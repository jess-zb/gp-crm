-- Remove portal-related onboarding checklist rows (legacy labels included).
DELETE FROM onboarding_checklist
WHERE item ILIKE '%portal%';

-- Default checklist for new clients (no portal item).
CREATE OR REPLACE FUNCTION create_default_checklist()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO onboarding_checklist (client_id, item) VALUES
    (NEW.id, 'Charge CC Information'),
    (NEW.id, 'Send Welcome Packet + POA'),
    (NEW.id, 'Signed POA Received'),
    (NEW.id, 'Collection Letter Received');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
