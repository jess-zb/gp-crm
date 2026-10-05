-- Arizona time is the corner clock. Appointments show the client and the viewer's clock.

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$3. Choose the client, the date and time, and a short description of why you are calling. Enter the date and time in the client's time zone, from their state and ZIP. The appointment then shows that time, Arizona time, and the time on your own computer.$old$,
  $new$3. Choose the client, the date and time, and a short description of why you are calling. Enter the date and time in the client's time zone, from their state and ZIP. The appointment shows that time and the time on your own computer. Current Arizona time stays in the bottom-right corner.$new$
)
WHERE title = 'Appointments';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$## Two buttons in the bottom-right

1. The magnifying glass searches every client and jumps to a page. Type a name, a phone number, or a spouse's name.
2. The speech bubble opens messages with other staff. It is not email to the client.$old$,
  $new$## The bottom-right corner

1. The clock shows the current Arizona time.
2. The magnifying glass searches every client and jumps to a page. Type a name, a phone number, or a spouse's name.
3. The speech bubble opens messages with other staff. It is not email to the client.$new$
)
WHERE title = 'Navigate System';
