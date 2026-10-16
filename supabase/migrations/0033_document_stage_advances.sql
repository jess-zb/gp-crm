-- Uploads move the stage in order.
-- Credit card form from New Lead or Account Manager → Client Services,
-- or Awaiting Collections when the Welcome Packet is already on file.
-- Welcome Packet from Client Services → Awaiting Collections.
-- A Welcome Packet on a New Lead with no card form moves them to Account Manager.
-- From Account Manager, the packet moves the stage only when the card form is already on file.

CREATE OR REPLACE FUNCTION public.handle_poa_upload() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  advanced int;
  from_stage text;
  next_stage text;
BEGIN
  IF NEW.document_type::text NOT IN (
    'poa_document',
    'poa_signed',
    'poa',
    'power_of_attorney'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO from_stage
  FROM clients
  WHERE id = NEW.client_id;

  IF from_stage = 'client_services' THEN
    next_stage := 'awaiting_collection_letter';
  ELSIF from_stage IN ('lead', 'account_manager') AND EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.client_id = NEW.client_id
      AND d.archived_at IS NULL
      AND d.document_type::text = 'cc_authorization'
  ) THEN
    next_stage := 'awaiting_collection_letter';
  ELSIF from_stage = 'lead' THEN
    next_stage := 'account_manager';
  ELSE
    RETURN NEW;
  END IF;

  UPDATE clients
  SET
    stage = next_stage,
    stage_entered_at = NOW()
  WHERE id = NEW.client_id
    AND stage = from_stage;

  GET DIAGNOSTICS advanced = ROW_COUNT;

  IF advanced > 0 THEN
    UPDATE onboarding_checklist
    SET
      completed = true,
      completed_at = NOW()
    WHERE client_id = NEW.client_id
      AND item ILIKE '%poa%'
      AND completed = false;

    INSERT INTO audit_log (client_id, action, new_value, performed_by_name)
    VALUES (
      NEW.client_id,
      'stage_auto_advanced',
      jsonb_build_object(
        'stage', next_stage,
        'trigger', 'poa_upload',
        'from_stage', from_stage,
        'document_id', NEW.id
      ),
      'System'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_cc_auth_upload() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  advanced int;
  from_stage text;
  next_stage text;
BEGIN
  IF NEW.document_type::text <> 'cc_authorization' THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO from_stage
  FROM clients
  WHERE id = NEW.client_id;

  IF from_stage NOT IN ('lead', 'account_manager') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.client_id = NEW.client_id
      AND d.archived_at IS NULL
      AND d.document_type::text IN (
        'poa_document',
        'poa_signed',
        'poa',
        'power_of_attorney'
      )
  ) THEN
    next_stage := 'awaiting_collection_letter';
  ELSE
    next_stage := 'client_services';
  END IF;

  UPDATE clients
  SET
    stage = next_stage,
    stage_entered_at = NOW()
  WHERE id = NEW.client_id
    AND stage = from_stage;

  GET DIAGNOSTICS advanced = ROW_COUNT;

  IF advanced > 0 THEN
    INSERT INTO audit_log (client_id, action, new_value, performed_by_name)
    VALUES (
      NEW.client_id,
      'stage_auto_advanced',
      jsonb_build_object(
        'stage', next_stage,
        'trigger', 'cc_authorization_upload',
        'from_stage', from_stage,
        'document_id', NEW.id
      ),
      'System'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cc_auth_upload ON public.documents;
CREATE TRIGGER on_cc_auth_upload
  AFTER INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_cc_auth_upload();

-- Knowledge Base matches the path above.

INSERT INTO public.knowledge_base_articles (title, body, category, sort_order)
SELECT $kb$The path of a client$kb$, $kb$This is the path every client should take. Do the steps in order. Three of the steps move by themselves when you upload the right file.

## 1. New Lead

A text file is dropped on the **Clients** page. That file has the person's name, phone, address, and cards. The same file is saved under **Documents**, so you can always open it.

The client starts as **New Lead**. Nobody is assigned yet.

If the credit card form is uploaded here, the client moves to **Client Services**. That catches a file when someone forgets to move it to Account Manager. If the Welcome Packet is already on the file, that same upload moves them to **Awaiting Collections**.

If the Welcome Packet is uploaded here before the credit card form, the packet is saved and the client stays a New Lead. Upload the card form next.

## 2. Account Manager

Charge the card. When the charge works, open the client and change the stage to **Account Manager**. Pick the Account Manager. That is the person the client talks to.

Then get the credit card form signed on the phone.

1. Click **Documents**.
2. Click **Upload +**.
3. Choose **CC Authorization**.
4. Upload the signed form.

The client moves to **Client Services** by itself. You do not change the stage for this step.

## 3. Client Services

This step is the Welcome Packet. Get it signed, then upload it.

1. Click **Documents**.
2. Click **Upload +**.
3. Choose **Welcome Packet**.
4. Upload the signed packet.

The client moves to **Awaiting Collections** by itself.

Do both uploads on the same call when you can. The best end of that call is Awaiting Collections.

If you upload the Welcome Packet before the credit card form, the packet is saved and the client stays in Account Manager. Upload the card form next. If the packet is already there, that upload moves them the rest of the way.

Pick a Client Services person on **Settings** if one is not picked yet. The stage moves even if you have not picked them. Do not leave the file with nobody.

## 4. Awaiting Collections

The letter may take weeks or months. When it arrives, upload it.

1. Click **Documents**.
2. Click **Upload +**.
3. Choose **Collection Letter**.
4. Upload the letter.

The client moves to **Case Sent to Attorneys** by itself.

## 5. Successful

Case Sent to Attorneys is the best ending. The client went from New Lead all the way through.

Open **Clients**, then **Successful**, to see everyone who made it.

Do not use **Cancel** or **Closed** for this. Those mean the client stopped. Successful clients stay on the Successful list.

## If they stop

Use **Cancel** when the person is not going forward. That is not a success. Those files go to **Archives**.
$kb$, $kb$Start here$kb$, 15
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_base_articles WHERE title = $kb$The path of a client$kb$
);

UPDATE public.knowledge_base_articles
SET body = $kb$This is the path every client should take. Do the steps in order. Three of the steps move by themselves when you upload the right file.

## 1. New Lead

A text file is dropped on the **Clients** page. That file has the person's name, phone, address, and cards. The same file is saved under **Documents**, so you can always open it.

The client starts as **New Lead**. Nobody is assigned yet.

If the credit card form is uploaded here, the client moves to **Client Services**. That catches a file when someone forgets to move it to Account Manager. If the Welcome Packet is already on the file, that same upload moves them to **Awaiting Collections**.

If the Welcome Packet is uploaded here before the credit card form, the packet is saved and the client stays a New Lead. Upload the card form next.

## 2. Account Manager

Charge the card. When the charge works, open the client and change the stage to **Account Manager**. Pick the Account Manager. That is the person the client talks to.

Then get the credit card form signed on the phone.

1. Click **Documents**.
2. Click **Upload +**.
3. Choose **CC Authorization**.
4. Upload the signed form.

The client moves to **Client Services** by itself. You do not change the stage for this step.

## 3. Client Services

This step is the Welcome Packet. Get it signed, then upload it.

1. Click **Documents**.
2. Click **Upload +**.
3. Choose **Welcome Packet**.
4. Upload the signed packet.

The client moves to **Awaiting Collections** by itself.

Do both uploads on the same call when you can. The best end of that call is Awaiting Collections.

If you upload the Welcome Packet before the credit card form, the packet is saved and the client stays in Account Manager. Upload the card form next. If the packet is already there, that upload moves them the rest of the way.

Pick a Client Services person on **Settings** if one is not picked yet. The stage moves even if you have not picked them. Do not leave the file with nobody.

## 4. Awaiting Collections

The letter may take weeks or months. When it arrives, upload it.

1. Click **Documents**.
2. Click **Upload +**.
3. Choose **Collection Letter**.
4. Upload the letter.

The client moves to **Case Sent to Attorneys** by itself.

## 5. Successful

Case Sent to Attorneys is the best ending. The client went from New Lead all the way through.

Open **Clients**, then **Successful**, to see everyone who made it.

Do not use **Cancel** or **Closed** for this. Those mean the client stopped. Successful clients stay on the Successful list.

## If they stop

Use **Cancel** when the person is not going forward. That is not a success. Those files go to **Archives**.
$kb$, category = $kb$Start here$kb$, sort_order = 15
WHERE title = $kb$The path of a client$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$This guide is for someone who has never used Golden Pathway before. You do not need to be good with computers. Read one article, do that job, then come back for the next one.

## Which section to open

1. Everyone starts with **Start here**.
2. If your job is Account Manager, open **Account Managers** next.
3. If your job is Client Services, open **Client Services** next.
4. **Working a client** is for both of those jobs. It is the page you live on.
5. **Admins** is only for people who set up the team, the documents, and the reports.

If you are not sure which job you have, read **Roles & Departments** before you do anything else.

Read **The path of a client** before you work a file. That article is the order. Do not skip a step.

## How an article is written

Each article has three kinds of help.

- A short explanation of what the screen is for.
- Numbered steps. Do them in order. Do not skip ahead.
- A picture of the real screen, so you can match what you see.

The pictures are of the live pages, not a drawing. Your screen may be light or dark. The buttons are in the same place either way. There is no separate video. The picture plus the numbered steps is the walkthrough.

## If you get stuck

1. Look at the left sidebar. The gold row is the page you are on.
2. Use the search button in the bottom-right corner. It is the magnifying glass. You can also press **Command** and **K** on a Mac, or **Control** and **K** on Windows.
3. Ask an admin. Do not guess on a stage change, a refund, or a signature.
$kb$, category = $kb$Start here$kb$, sort_order = 10
WHERE title = $kb$Learning Guide$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$Two different labels decide what you can do. They are not the same thing.

## Role

The role is the second line under your name in the sidebar.

- **Admin** can see the whole book, the team, reports, refunds, and the attorney queue.
- **User** means you are staff. It does not tell you which clients are yours. Your department does that.
- **Attorney** does not use this sidebar. Attorneys sign in and land on **Cases**.
- **Client** is the person we serve. They use a separate portal. They never see this guide.

## Department

A department is a checkbox an admin sets on **Team** for a User. There are exactly two.

- **Account Managers** work the client while the file is in the Account Manager stage.
- **Client Services** work the client after the credit card form is uploaded, until the signed Welcome Packet is on file. That upload moves the file to Awaiting Collections.

One person can be in both departments. Admins are already in both, so they show up on Account Manager and Client Services lists without those checkboxes. If you are in both, and you are not an admin, your dashboard is the Account Manager dashboard.

## What you should open

1. Look under your name.
2. If it says Admin, start with **What admins see**.
3. If it says User, ask an admin whether you are Account Managers, Client Services, or both. Then open that section.
4. If the dashboard says your department is not set up yet, stop and ask an admin to check **Team**. Do not create clients until that is fixed.
$kb$, category = $kb$Start here$kb$, sort_order = 30
WHERE title = $kb$Roles & Departments$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$You will see the same words on every page. Here is what they mean in this company.

- **Client** is the person Golden Pathway is helping. Their spouse can be on the file too. The spouse is not a second client.
- **Stage** is where the file sits in the work. The usual path is New Lead, then Account Manager, then Client Services, then Awaiting Collections, then Case Sent to Attorneys. That last step is a success. Closed is a different stage. It is not a success, and it is not a status.
- **MID** is a label on the client, such as Golden Pathway. It chooses which signature documents that client is offered. It does not hide the client from other staff. Everyone on the staff side can open every client.
- **Credit card authorization** is the signed card form. Uploading it while the client is in Account Manager moves them to Client Services.
- **Welcome Packet** is the signed packet. Uploading it while the client is in Client Services moves them to Awaiting Collections.
- **Appointment** is a call or meeting on the calendar. It is not an email.
- **Drip** is an automatic email sequence. It is not a text message, and nothing is mailed on paper.
- **Status** is Active or Inactive. Cancel marks the file Inactive, and so does moving the stage to Closed, DNC, DNQ, Not Interested, or Mortgage. **Archives** is the list of inactive files. Search still finds them.

There is no shipping, no tracking number, and no print vendor in this system. Documents go out for signature on the screen, or a staff member uploads a file that was already signed.
$kb$, category = $kb$Start here$kb$, sort_order = 40
WHERE title = $kb$Word Dictionary$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$This is the path for an Account Manager. Do the steps in order on a new file. Later articles explain each click.

1. Open **Dashboard** and read who is waiting on you.
2. Open **Clients** and choose **Add New Client** when someone new comes in. A MID and an Account Manager are required.
3. Open the client. Check the phone, email, address, and verbal password on the left.
4. Get the **credit card authorization** signed on the phone and upload it. The client moves to Client Services by itself.
5. Book the next call on **Appointments** if the call is not finished.
6. You do not move the stage to Client Services by hand after the card form is uploaded. The upload does that. Still pick a Client Services person on Settings if one is not picked yet.

You do not send paper packets. You do not need a signed Welcome Packet to leave Account Manager. The card form is what moves them. The Welcome Packet comes next, in Client Services, and that upload moves them to Awaiting Collections.

If the person should leave the pipeline instead (they cancelled, they are not interested, or the file should close), use **Cancel client** on their page. Those exits are not held up by the missing card form.
$kb$, category = $kb$Account Managers$kb$, sort_order = 110
WHERE title = $kb$Your day as an Account Manager$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$A client in Account Manager cannot move to a later stage until a signed credit card authorization is on their Documents tab. There is no bypass.

The file counts if it was signed through e-sign, or if you uploaded the signed copy yourself. A missing card form used to be described as a warning only. That is no longer true. Do not follow any older note that says the Welcome Packet is what lets them leave Account Manager.

## What you do

1. Open the client.
2. If the top of the page says paperwork is missing before the next stage, click that notice. It opens Documents.
3. If you can see **E-Sign**, send the card authorization for that client's MID. Send is for clients in Account Manager or Client Services.
4. If you cannot see E-Sign, it is turned off. Uploads still work. Click **Upload +**, choose **CC Authorization**, and add the signed file.
5. When the file appears in the list, the client moves to **Client Services** by itself. You do not change the stage for this step.

If the Welcome Packet is already on the file, the same upload moves them to **Awaiting Collections** instead. Both steps are done.

Clicking a name on the admin dashboard's **Missing CC Authorizations** list opens the upload box with CC Authorization already chosen.

Audio recordings never replace the card form. A note that says the client agreed on the phone is not enough. A New Lead moves the same way: the card form sends them to Client Services, and the Welcome Packet stays put until that form is on the file.
$kb$, category = $kb$Account Managers$kb$, sort_order = 140
WHERE title = $kb$Credit card authorization$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$The usual way out of Account Manager is the credit card form. Upload it and the client moves to **Client Services** by itself.

Use the stage dropdown near the client's name only when you need to move them by hand.

1. Confirm the credit card authorization is on Documents. If it is not, the change is blocked and the page tells you why.
2. Open **Settings** on the client, or click **Edit** next to Account Manager on the left. Assign a Client Services person so the file does not sit with nobody.
3. Change the stage to Client Services if the upload did not already do it.
4. If a box appears and will not let you continue, use the link in that box. It takes you to the missing document. Do not keep clicking the stage.

## When you are not moving them forward

**Cancel**, beside the stage dropdown, is the button for leaving the pipeline. Cancel and similar exits are not held for the card form. Use it only when the client is actually done, not when you are stuck on a document.

After the file is in Client Services, your Account Manager dashboard no longer treats it as your queue. Client Services picks it up from their own dashboard.
$kb$, category = $kb$Account Managers$kb$, sort_order = 150
WHERE title = $kb$Move a client out of Account Manager$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$Client Services starts when the file arrives from Account Manager. The card authorization should already be on the file. Your gate is different.

1. Open **Dashboard** and see who is assigned to you.
2. Open each client. Read the notes and the Documents tab before you call.
3. Collect the signed Welcome Packet.
4. Book follow-up appointments.
5. Upload the signed Welcome Packet. The client moves to **Awaiting Collections** by itself.

You cannot make that move with the Welcome Packet missing. There is no checklist card on the client page anymore. Do not look for boxes named CS Intro or Tracking Update. Those were removed.

If a file has been in Client Services for a long time with no Welcome Packet, it shows on your dashboard as overdue.
$kb$, category = $kb$Client Services$kb$, sort_order = 210
WHERE title = $kb$Your day in Client Services$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$Awaiting Collections stays locked until a signed Welcome Packet is on the client.

The signed copy counts when the Welcome Packet is on Documents, or when the signed date is already stored on the client. Sending it for signature, and uploading a signed copy you already have, are both valid. A conversation is not.

## What you do

1. Open the client and click **Documents**.
2. If E-Sign is visible, send the document that belongs to this client's MID. Do not send another MID's file.
3. If E-Sign is hidden, click **Upload +**, choose **Welcome Packet**, and add the signed PDF.
4. When the file is saved, the client moves to **Awaiting Collections** by itself. You do not change the stage for this step.

The client has to be in Client Services first. If they are still a New Lead or in Account Manager, upload the credit card form first. That moves them to Client Services. If the Welcome Packet is already on the file, the card form then moves them to Awaiting Collections.

The client header can show a missing-paperwork notice. Click it. For a missing Welcome Packet it opens the upload form with Welcome Packet already selected.

An audio file never moves the stage.
$kb$, category = $kb$Client Services$kb$, sort_order = 230
WHERE title = $kb$The signed Welcome Packet$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$Open the client and click **Documents**.

![The Documents tab](/kb/documents.png)

This tab is the file cabinet. Uploads are always here. E-Sign may be hidden. Read **E-sign** if you do not see it.

## Upload a file

1. Click **Upload +**.
2. Choose the file type before you pick the file. The common ones are **CC Authorization**, **Welcome Packet**, **Collection Letter**, **Audio Recording**, and **Other**.
3. Choose the file from your computer. PDF, text, pictures, common audio, video, and Word files are accepted.
4. Notes are optional. They are for staff, not for the client.
5. Click **Upload** and wait until the file appears in the list.

Pick the real type. A card form uploaded as Other does not count as the credit card authorization, so the stage will stay blocked.

**CC Authorization**, **Welcome Packet**, and **Collection Letter** can move the stage. The other types do not.

You can preview a file from the list. Attorneys who are allowed onto the file can download from their own portal. You do not email the file to yourself to "save a copy" unless an admin asks.

Older bookmarks that say packets or letters open this same Documents tab. There is no separate mail room.
$kb$, category = $kb$Working a client$kb$, sort_order = 330
WHERE title = $kb$Documents and uploads$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$**Pipeline** is the same clients you see in the list, one stage at a time, so you can see the pile at each step.

![The Pipeline, on the Sales view](/kb/pipeline.png)

1. Click **Pipeline**.
2. Choose **Sales** or **Service** at the top. Sales shows New Leads, Account Manager, and Retention. Service shows Client Services, Awaiting Collection Letter, and Case Sent to Attorneys.
3. Click the stage name. The number beside it is how many clients are in that stage.
4. Click a client's name to open the file. Change the stage on the client page, not from this list.

This page does not drag people between stages. If a move is not allowed, the client page explains what is missing.

Use Pipeline when you want to see volume. Use your dashboard when you want to see your own work for today.
$kb$, category = $kb$Working a client$kb$, sort_order = 380
WHERE title = $kb$The Pipeline$kb$;
