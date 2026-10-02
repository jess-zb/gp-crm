-- Allow clients to select both FedEx and DocuSign on intake
DO $$
BEGIN
  ALTER TYPE delivery_method ADD VALUE 'both';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
