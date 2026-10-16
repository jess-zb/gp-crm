-- A second profile that belongs with this one, such as a spouse who has
-- their own file. The name fields stay for someone who has no profile yet.

ALTER TABLE public.clients
  ADD COLUMN linked_client_id uuid;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_linked_client_id_fkey
  FOREIGN KEY (linked_client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX clients_linked_client_id_idx ON public.clients (linked_client_id);
