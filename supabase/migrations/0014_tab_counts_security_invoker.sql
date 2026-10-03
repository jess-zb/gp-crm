-- Make the list tab-count explicit: it runs as the caller, so RLS applies.
ALTER FUNCTION public.crm_client_tab_counts(uuid) SECURITY INVOKER;
