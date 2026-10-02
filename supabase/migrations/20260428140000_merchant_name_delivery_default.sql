-- Billing: merchant per charge row
ALTER TABLE client_cards ADD COLUMN IF NOT EXISTS merchant_name TEXT;

