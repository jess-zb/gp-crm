-- Public read bucket for Teach Me guide screenshots (CRM path: guide-screenshots/{slug}/step-{n}.png)
INSERT INTO storage.buckets (id, name, public)
VALUES ('guide-screenshots', 'guide-screenshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read guide screenshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'guide-screenshots');

CREATE POLICY "Dev admin insert guide screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'guide-screenshots'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('dev', 'admin')
  )
);

CREATE POLICY "Dev admin update guide screenshots"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'guide-screenshots'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('dev', 'admin')
  )
)
WITH CHECK (
  bucket_id = 'guide-screenshots'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('dev', 'admin')
  )
);

CREATE POLICY "Dev admin delete guide screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'guide-screenshots'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('dev', 'admin')
  )
);
