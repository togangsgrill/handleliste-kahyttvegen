-- Per-liste standardbutikk: lar brukeren ha ulike "stamkunde"-butikker per
-- handleliste (f.eks. Eurospar-liste for tilbudsvarer, Kiwi-liste for daglig).
alter table public.shopping_lists
  add column if not exists default_store_location_id uuid
    references public.store_locations(id) on delete set null;

comment on column public.shopping_lists.default_store_location_id is
  'Foretrukket butikk for denne listen. Overstyrer husholdningens generelle favoritt ved åpning av listen.';
