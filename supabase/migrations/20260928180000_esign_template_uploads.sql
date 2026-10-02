-- Private bucket for qualified staff to replace blank eSign PDFs.
-- Service role reads and writes through the app. No public access.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('esign-templates', 'esign-templates', false, 8388608)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit;
