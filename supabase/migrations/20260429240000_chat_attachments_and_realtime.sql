-- Private bucket for Communications hub file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated read chat-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert chat-attachments" ON storage.objects;

CREATE POLICY "Authenticated read chat-attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated insert chat-attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- Realtime: hub listens for new rows (run once per project; skip if already in publication)
ALTER PUBLICATION supabase_realtime ADD TABLE communications;
ALTER PUBLICATION supabase_realtime ADD TABLE portal_messages;
