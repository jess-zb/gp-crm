-- Allow account managers to edit all fields on client_cards, not just authorization_status.
-- Removes the BEFORE UPDATE trigger that previously restricted acct_manager updates.
-- The existing "Acct manager update cards" RLS policy already grants full UPDATE — this
-- migration just drops the field-level guard that overrode it.

DROP TRIGGER IF EXISTS trg_client_cards_acct_manager_auth_only ON client_cards;
DROP TRIGGER IF EXISTS enforce_acct_manager_card_auth ON client_cards;
DROP FUNCTION IF EXISTS enforce_client_cards_acct_manager_auth_only();
