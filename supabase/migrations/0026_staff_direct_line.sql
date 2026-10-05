-- Staff direct line, shown next to Account Manager and Client Services names.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS direct_line text;

COMMENT ON COLUMN public.profiles.direct_line IS
  'Staff direct phone line. Shown with the person''s name when they are the Account Manager or Client Services assignee.';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$5. Save.$old$,
  $new$5. Set **Direct line**. That number shows next to their name wherever they are the Account Manager or the Client Services person.
6. Save.$new$
)
WHERE title = 'Team';
