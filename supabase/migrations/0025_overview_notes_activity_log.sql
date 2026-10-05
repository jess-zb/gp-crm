-- The Activity tab is gone. Calls, texts, emails, and notes live under Overview Notes.

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$The tabs are Overview, Activity, Documents, Drips, and Settings. The MID menu sits on that same bar on a computer. On a phone, the tabs come first and the MID menu is on the next line, so the tabs are not covered.$old$,
  $new$The tabs are Overview, Documents, Drips, and Settings. The MID menu sits on that same bar on a computer. On a phone, the tabs come first and the MID menu is on the next line, so the tabs are not covered.$new$
)
WHERE title = 'The client page';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$The notice is only on Overview. If you are on Activity or Documents, you will not see it. Go back to Overview.

## Notes

Notes are on Overview, under that notice. Write what happened on the call in plain sentences. Another person should be able to pick up the file without asking you.

Do not put a card number in a note. Do not put a password other than the verbal password the form already stores.

## Activity

**Activity** is the history of emails and stage changes for people who are allowed to see it. Admins see the fuller activity log. If you do not see a log you expected, that is the permission, not a broken page.$old$,
  $new$The notice is only on Overview. If you are on Documents, you will not see it. Go back to Overview.

## Notes

Notes are on Overview, under Appointments. The small icons log a call, text, email, or note. Those entries stack in this section, shortened until you click one, which opens the full message in place.

Do not put a card number in a note. Do not put a password other than the verbal password the form already stores.

## Activity log

The activity log is under that list, still on Overview. It is the history of what happened on the file, such as stage changes. There is no separate Activity tab.$new$
)
WHERE title = 'Overview, notes, and missing paperwork';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$The MID menu is on the tab bar, to the right of Overview, Activity, Documents, Drips, and Settings. On a phone it is under the tabs.$old$,
  $new$The MID menu is on the tab bar, to the right of Overview, Documents, Drips, and Settings. On a phone it is under the tabs.$new$
)
WHERE title = 'Assignments and the MID';
