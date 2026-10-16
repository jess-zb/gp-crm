-- DVCR archive pages were pasted into the staff guide by mistake.
-- They are not part of Golden Pathway training.

DELETE FROM public.knowledge_base_articles
WHERE title ILIKE '%dvcr%'
   OR body ILIKE '%dvcr%'
   OR category ILIKE '%dvcr%';
