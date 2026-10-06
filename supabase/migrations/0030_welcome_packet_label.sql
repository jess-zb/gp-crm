-- Staff-facing name is Welcome Packet. Stored document types are unchanged.

UPDATE public.knowledge_base_articles
SET title = 'The signed Welcome Packet'
WHERE title = 'The signed POA';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$- **Client Services** work the client after that, until the signed POA is on file and the file can move on.$old$,
  $new$- **Client Services** work the client after that, until the signed Welcome Packet is on file and the file can move on.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$- **POA** is the signed power of attorney. The signed Welcome Packet is stored as the POA. It must be on the file before the client leaves Client Services for Awaiting Collections.$old$,
  $new$- **Welcome Packet** is the signed packet. It must be on the file before the client leaves Client Services for Awaiting Collections.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$The Welcome Packet matters later, as the POA, when Client Services is ready to move the file to Awaiting Collections.$old$,
  $new$The Welcome Packet matters later, when Client Services is ready to move the file to Awaiting Collections.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$3. Collect the signed POA. The signed Welcome Packet is stored as that POA.$old$,
  $new$3. Collect the signed Welcome Packet.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$5. When the signed POA is on the file, you can move the stage to **Awaiting Collections**.$old$,
  $new$5. When the signed Welcome Packet is on the file, you can move the stage to **Awaiting Collections**.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$You cannot make that move with the POA missing. Uploading the POA is the way through.$old$,
  $new$You cannot make that move with the Welcome Packet missing. Uploading the Welcome Packet is the way through.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$If a file has been in Client Services for a long time with no POA, it shows on your dashboard as overdue.$old$,
  $new$If a file has been in Client Services for a long time with no Welcome Packet, it shows on your dashboard as overdue.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$- How many are POA overdue. That means 21 days or more in Client Services with no signed POA.$old$,
  $new$- How many are Welcome Packet overdue. That means 21 days or more in Client Services with no signed Welcome Packet.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$1. **My clients** lists your files. The status says **POA signed**, **No POA**, or **POA overdue**. Click a row that is not signed. It opens Documents with the POA upload already chosen.$old$,
  $new$1. **My clients** lists your files. The status says **Welcome Packet signed**, **No Welcome Packet**, or **Welcome Packet overdue**. Click a row that is not signed. It opens Documents with the Welcome Packet upload already chosen.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$3. **POA follow-up** is the overdue list, so you can call those people first.$old$,
  $new$3. **Welcome Packet follow-up** is the overdue list, so you can call those people first.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$Awaiting Collections stays locked until a signed POA is on the client.$old$,
  $new$Awaiting Collections stays locked until a signed Welcome Packet is on the client.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$The signed copy counts when the POA file is on Documents, or when the signed date is already stored on the client. Sending the Welcome Packet for signature, and uploading a POA you already have, are both valid. A conversation is not.$old$,
  $new$The signed copy counts when the Welcome Packet is on Documents, or when the signed date is already stored on the client. Sending it for signature, and uploading a signed copy you already have, are both valid. A conversation is not.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$3. If E-Sign is hidden, click **Upload +**, choose **POA File**, and add the signed PDF.$old$,
  $new$3. If E-Sign is hidden, click **Upload +**, choose **Welcome Packet**, and add the signed PDF.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$The client header can show a missing-paperwork notice. Click it. For a missing POA it opens the upload form with POA already selected.$old$,
  $new$The client header can show a missing-paperwork notice. Click it. For a missing Welcome Packet it opens the upload form with Welcome Packet already selected.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$The POA does not move the client by itself in every case.$old$,
  $new$The Welcome Packet does not move the client by itself in every case.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$- A missing POA opens the upload form with POA already selected.$old$,
  $new$- A missing Welcome Packet opens the upload form with Welcome Packet already selected.$new$
);

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$**CC Authorization**, **POA File**, **Collection Letter**$old$,
  $new$**CC Authorization**, **Welcome Packet**, **Collection Letter**$new$
);

UPDATE public.email_message_templates
SET default_body = replace(default_body, 'signed POA', 'the signed Welcome Packet')
WHERE template_key = 'attorney_portal_assignment'
  AND default_body LIKE '%signed POA%';

-- Older guide rows that still say POA.
UPDATE public.knowledge_base_articles
SET
  title = replace(title, 'POA', 'Welcome Packet'),
  body = replace(replace(body, 'POA File', 'Welcome Packet'), 'POA', 'Welcome Packet')
WHERE title LIKE '%POA%' OR body LIKE '%POA%';
