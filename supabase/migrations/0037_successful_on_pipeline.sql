-- The win list moved from Clients to Pipeline → Service → Successful.

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  'Open **Clients**, then **Successful**, to see everyone who made it.

Do not use **Cancel** or **Closed** for this. Those mean the client stopped. Successful clients stay on the Successful list.',
  'Open **Pipeline**, choose **Service**, then **Successful**. That tab sits after Case Sent to Attorneys.

Do not use **Cancel** or **Closed** for this. Those mean the client stopped. Successful clients stay on that Pipeline tab.'
)
WHERE title = 'The path of a client'
  AND body LIKE '%Open **Clients**, then **Successful**%';
