-- Billing: merchant per charge row
ALTER TABLE client_cards ADD COLUMN IF NOT EXISTS merchant_name TEXT;

-- New clients no longer set delivery_method from intake; keep column nullable with no default
ALTER TABLE clients ALTER COLUMN delivery_method DROP DEFAULT;
