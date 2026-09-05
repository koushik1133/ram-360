-- Orion 360 buyer portal · Supabase schema
-- Run in the SQL editor of your Supabase project (or `supabase db push`).

create type flat_status as enum ('available', 'sold', 'reserved');

create table if not exists public.flats (
  id          text primary key,              -- e.g. A-1201
  tower       text not null,
  floor       int  not null,
  flat_no     text not null,
  bhk         int  not null,
  sqft        int  not null,
  facing      text not null,
  status      flat_status not null default 'available',
  price       text,
  updated_at  timestamptz not null default now()
);

create index if not exists flats_tower_floor_idx on public.flats (tower, floor);

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  email       text not null,
  unit        text references public.flats(id),
  message     text,
  engagement  jsonb,
  source      text default 'navigo-web',
  created_at  timestamptz not null default now()
);

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists flats_touch on public.flats;
create trigger flats_touch before update on public.flats for each row execute function public.touch_updated_at();

-- Realtime: stream flat status changes to every open browser
alter publication supabase_realtime add table public.flats;

-- Row level security
alter table public.flats enable row level security;
alter table public.leads enable row level security;

create policy "flats are public" on public.flats for select using (true);
create policy "anyone can submit a lead" on public.leads for insert with check (true);
-- Only the service role (admin dashboard / seed script) may update flats or read leads.

-- Storage buckets for heavy assets (create in dashboard or via CLI):
--   models (public, cache-control 31536000)  -> towers.glb
--   panos  (public)                          -> *.jpg equirectangular
--   plans  (public)                          -> *.svg
