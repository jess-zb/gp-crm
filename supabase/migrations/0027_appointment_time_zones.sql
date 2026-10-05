-- Appointments are entered in the client's time zone and shown in three clocks.

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$3. Choose the client, the date and time, and a short description of why you are calling.$old$,
  $new$3. Choose the client, the date and time, and a short description of why you are calling. Enter the date and time in the client's time zone, from their state and ZIP. The appointment then shows that time, Arizona time, and the time on your own computer.$new$
)
WHERE title = 'Appointments';
