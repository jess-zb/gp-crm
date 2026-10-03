-- Staff Knowledge Base. Articles live in the database.
-- Admins and dev can write. Other CRM staff can read.

CREATE TABLE public.knowledge_base_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_base_articles_title_not_blank CHECK (btrim(title) <> '')
);

CREATE INDEX knowledge_base_articles_sort_idx
  ON public.knowledge_base_articles (sort_order, title);

CREATE TRIGGER knowledge_base_articles_updated_at
  BEFORE UPDATE ON public.knowledge_base_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read knowledge base"
  ON public.knowledge_base_articles
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('dev', 'admin', 'acct_manager'));

CREATE POLICY "Leadership insert knowledge base"
  ON public.knowledge_base_articles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('dev', 'admin'));

CREATE POLICY "Leadership update knowledge base"
  ON public.knowledge_base_articles
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('dev', 'admin'))
  WITH CHECK (public.current_user_role() IN ('dev', 'admin'));

CREATE POLICY "Leadership delete knowledge base"
  ON public.knowledge_base_articles
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('dev', 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base_articles TO authenticated;
GRANT ALL ON public.knowledge_base_articles TO service_role;

INSERT INTO public.knowledge_base_articles (title, body, sort_order) VALUES
(
  'Creating a client and choosing a MID',
  $kb$From **Clients**, choose **Add New Client**.

A MID is required. Select it on the form before you save. The client keeps that MID through attorney hand-off.

The assignee list is people marked as Account Managers. An admin sets that on **Team** when the list is empty.$kb$,
  10
),
(
  'What the MID controls',
  $kb$A MID is a label. It is not a permission boundary, and it does not hide clients from other staff. Everyone on the CRM can open every client.

The MID chooses which e-sign documents that client is offered. Card authorization and the Welcome Packet are files on the MID, not one shared pair for the whole company.$kb$,
  20
),
(
  'The Documents tab',
  $kb$Open a client and choose **Documents**.

**E-Sign** sends that MID's documents for signature. Send is available while the client is in Account Manager or Client Services.

**Uploads** is the file already on the client, including a signed Welcome Packet and collection letters.

Older links for a packets tab or a letters tab open Documents.$kb$,
  30
),
(
  'Leaving Account Manager',
  $kb$A client in Account Manager cannot move forward until the Welcome Packet is signed.

The signed copy counts when it is on Documents as a POA, or when the signed date is set. Send it from **Documents → E-Sign**, or upload the signed file.

A missing card authorization is a warning. It does not stop the stage change. Cancel and disqualify destinations are not held for the Welcome Packet.$kb$,
  40
),
(
  'Adding a MID and its documents',
  $kb$Admins and the dev account open **Settings → MIDs & E-Sign Documents**.

Add the MID by name, then open it and upload that MID's card authorization and Welcome Packet PDFs. Those files are what E-Sign offers to clients on that MID.

Signature boxes are placed on the PDFs from the dev login. Adding the MID does not place them.$kb$,
  50
),
(
  'Adding or editing a Knowledge Base article',
  $kb$Open **Knowledge Base** in the sidebar.

Admins and the dev account can add an article, edit the title and body, change the order, and delete. Other staff can read. The article is stored in the database, so saving one does not require a code change.

Use a short title. The body can include headings, lists, and **bold**.$kb$,
  60
);
