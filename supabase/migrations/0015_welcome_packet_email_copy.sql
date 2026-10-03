-- The day-30 client email still told people a Welcome Packet could take 10
-- days in the mail. Signing is an emailed link.

UPDATE public.email_message_templates
SET default_body = replace(
  default_body,
  '- Your Welcome packet may take up to 10 days (if you haven''t received it, call (888) 807-4221).',
  '- If you still need to sign your Welcome Packet, use the link we emailed you (or call 928-433-8408).'
)
WHERE template_key = 'active_4'
  AND default_body LIKE '%may take up to 10 days%';
