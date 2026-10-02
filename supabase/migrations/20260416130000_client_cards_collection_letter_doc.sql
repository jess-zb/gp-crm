-- Link a collection letter document to a card (billing tab attach flow)
ALTER TABLE client_cards
  ADD COLUMN IF NOT EXISTS collection_letter_doc_id UUID REFERENCES documents (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_cards_collection_letter_doc_id
  ON client_cards (collection_letter_doc_id);
