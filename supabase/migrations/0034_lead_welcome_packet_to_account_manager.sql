-- A Welcome Packet uploaded on a New Lead, before the credit card form,
-- moves that client to Account Manager. 0033 left them in New Lead.

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

UPDATE public.knowledge_base_articles
SET body = $kb$This is the path every client should take. Do the steps in order. Three of the steps move by themselves when you upload the right file.

## 1. New Lead

A text file is dropped on the **Clients** page. That file has the person's name, phone, address, and cards. The same file is saved under **Documents**, so you can always open it.

The client starts as **New Lead**. Nobody is assigned yet.

If the credit card form is uploaded here, the client moves to **Client Services**. That catches a file when someone forgets to move it to Account Manager. If the Welcome Packet is already on the file, that same upload moves them to **Awaiting Collections**.

If the Welcome Packet is uploaded here before the credit card form, the packet is saved and the client moves to **Account Manager**. Upload the card form next.

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
$kb$
WHERE title = $kb$The path of a client$kb$;

UPDATE public.knowledge_base_articles
SET body = $kb$Awaiting Collections stays locked until a signed Welcome Packet is on the client.

The signed copy counts when the Welcome Packet is on Documents, or when the signed date is already stored on the client. Sending it for signature, and uploading a signed copy you already have, are both valid. A conversation is not.

## What you do

1. Open the client and click **Documents**.
2. If E-Sign is visible, send the document that belongs to this client's MID. Do not send another MID's file.
3. If E-Sign is hidden, click **Upload +**, choose **Welcome Packet**, and add the signed PDF.
4. When the file is saved, the client moves to **Awaiting Collections** by itself. You do not change the stage for this step.

Uploading the Welcome Packet on a New Lead moves that client to Account Manager. From Account Manager, upload the credit card form first. That moves them to Client Services. If the Welcome Packet is already on the file, the card form then moves them to Awaiting Collections. From Client Services, the Welcome Packet itself moves them to Awaiting Collections.

The client header can show a missing-paperwork notice. Click it. For a missing Welcome Packet it opens the upload form with Welcome Packet already selected.

An audio file never moves the stage.
$kb$
WHERE title = $kb$The signed Welcome Packet$kb$;

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

Audio recordings never replace the card form. A note that says the client agreed on the phone is not enough. A New Lead moves the same way for the card form: it sends them to Client Services. Uploading the Welcome Packet on a New Lead moves them to Account Manager.
$kb$
WHERE title = $kb$Credit card authorization$kb$;
