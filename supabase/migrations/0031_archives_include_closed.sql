-- Status is is_active. Stage is not a second status.
-- Closing or cancelling sets is_active false so Archives, which counts
-- inactive files, includes them.

CREATE OR REPLACE FUNCTION public.crm_client_tab_counts(p_assigned_to uuid DEFAULT NULL::uuid)
RETURNS TABLE(all_count bigint, active_count bigint, archives_count bigint, priority_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE created_at >= TIMESTAMPTZ '2026-06-02 00:00:00+00'
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS all_count,
    COUNT(*) FILTER (
      WHERE is_active = true
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS active_count,
    COUNT(*) FILTER (
      WHERE is_active = false
        AND created_at >= TIMESTAMPTZ '2026-06-02 00:00:00+00'
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS archives_count,
    COUNT(*) FILTER (
      WHERE is_active = true
        AND stage = 'client_services'
        AND (p_assigned_to IS NULL OR assigned_to = p_assigned_to)
    ) AS priority_count
  FROM clients;
$$;

UPDATE public.clients
SET is_active = false
WHERE stage IN ('dnc', 'not_interested', 'dnq', 'mortgage', 'closed')
  AND is_active IS DISTINCT FROM false;

UPDATE public.knowledge_base_articles
SET body = $kb$You will see the same words on every page. Here is what they mean in this company.

- **Client** is the person Golden Pathway is helping. Their spouse can be on the file too. The spouse is not a second client.
- **Stage** is where the file sits in the work. The usual path is New Lead, then Account Manager, then Client Services, then Awaiting Collections, then Case Sent to Attorneys. Closed is a stage. It is not a status.
- **MID** is a label on the client, such as Golden Pathway. It chooses which signature documents that client is offered. It does not hide the client from other staff. Everyone on the staff side can open every client.
- **Credit card authorization** is the signed card form. It must be on the file before the client leaves Account Manager.
- **Welcome Packet** is the signed packet. It must be on the file before the client leaves Client Services for Awaiting Collections.
- **Appointment** is a call or meeting on the calendar. It is not an email.
- **Drip** is an automatic email sequence. It is not a text message, and nothing is mailed on paper.
- **Status** is Active or Inactive. Cancel marks the file Inactive, and so does moving the stage to Closed, DNC, DNQ, Not Interested, or Mortgage. **Archives** is the list of inactive files. Search still finds them.

There is no shipping, no tracking number, and no print vendor in this system. Documents go out for signature on the screen, or a staff member uploads a file that was already signed.$kb$
WHERE title = 'Word Dictionary';

UPDATE public.knowledge_base_articles
SET body = $kb$Cancel means the client is leaving the active path. It is not how you pause a file for a day.

1. Open the client.
2. Click **Cancel**, beside the stage dropdown.
3. Read the confirmation before you accept it. This is hard to undo casually.
4. If the company owes a refund, an admin handles that from **Clients**, then **Refunds**. Account Managers and Client Services do not see the Refunds tab. They can still request the cancel. An admin marks the refund complete.

Cancel marks the file Inactive and moves the stage. **Archives** on the Clients page is that inactive list. The stage name stays whatever you chose, including Closed. Search still finds them. If you do not see **All Clients**, use Active, Archives, and the search button.

Do not delete a client to hide a mistake. Tell an admin.$kb$
WHERE title = 'Cancel a client';
