-- Admins belong to both departments. Bring the staff guide in line with the assignee lists.

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$A department is a checkbox an admin sets on **Team**. There are exactly two.$old$,
  $new$A department is a checkbox an admin sets on **Team** for a User. There are exactly two.$new$
)
WHERE title = 'Roles & Departments';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$One person can be in both departments. If you are in both, and you are not an admin, your dashboard is the Account Manager dashboard.$old$,
  $new$One person can be in both departments. Admins are already in both, so they show up on Account Manager and Client Services lists without those checkboxes. If you are in both, and you are not an admin, your dashboard is the Account Manager dashboard.$new$
)
WHERE title = 'Roles & Departments';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$6. Choose the **Account Manager**. The list is only people marked as Account Managers on Team. If the list is empty, stop and ask an admin.$old$,
  $new$6. Choose the **Account Manager**. The list is people marked as Account Managers on Team, plus every admin. If the list is empty, stop and ask an admin.$new$
)
WHERE title = 'Create a client';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$Admins do not get the Account Manager dashboard or the Client Services dashboard, even if those department boxes are checked. You get the leadership page.$old$,
  $new$Admins do not get the Account Manager dashboard or the Client Services dashboard, even if those department boxes are checked. You get the leadership page. Admins still show up on both the Account Manager list and the Client Services list, so a file in either department can be assigned to an admin.$new$
)
WHERE title = 'What admins see';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$4. Check **Account Managers**, **Client Services**, or both. This is the department. The role by itself does not assign clients to them.$old$,
  $new$4. For a User, check **Account Managers**, **Client Services**, or both. That is their department. Admins are already in both lists.$new$
)
WHERE title = 'Team';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$The assignee lists on a new client only include people with the matching department checked. An empty Account Manager list means nobody is checked, not that the form is broken.$old$,
  $new$The assignee lists include people with the matching department checked, and every admin. An empty Account Manager list means nobody is checked and there is no admin, not that the form is broken.$new$
)
WHERE title = 'Team';

UPDATE public.knowledge_base_articles
SET body = replace(
  body,
  $old$2. **Accounts** is the Account Manager. **Services** is Client Services. **Assigned Attorney** is the attorney.$old$,
  $new$2. **Accounts** is the Account Manager. **Client Services** is the Client Services assignee. **Assigned Attorney** is the attorney.$new$
)
WHERE title = 'Assignments and the MID';
