-- Point the written path at the on-screen Daily workflow tour.

UPDATE public.knowledge_base_articles
SET body = 'The guided tour button is at the bottom right, next to the Arizona clock. Open it and choose **Daily workflow**. The CRM points at each screen and tells you what to click. This article is the same path in writing.'
  || E'\n\n'
  || body
WHERE title = 'The path of a client'
  AND body NOT ILIKE '%Daily workflow%';
