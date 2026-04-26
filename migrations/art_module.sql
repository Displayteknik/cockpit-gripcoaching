-- ART MODULE — verk + utställningar för Darek Uhrberg och framtida konstnärsklienter

-- 1. art_works
create table if not exists public.art_works (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  slug text not null,
  artist text,
  year integer,
  technique text,
  medium text,
  width_cm integer,
  height_cm integer,
  depth_cm integer,
  price integer default 0,
  price_label text,
  description text,
  image_url text,
  gallery jsonb default '[]'::jsonb,
  tags jsonb default '[]'::jsonb,
  status text default 'for_sale',
  is_featured boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (client_id, slug)
);
create index if not exists art_works_client_idx on public.art_works(client_id);
create index if not exists art_works_status_idx on public.art_works(status);

-- 2. art_exhibitions
create table if not exists public.art_exhibitions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  year integer not null,
  title text not null,
  venue text,
  city text,
  start_date date,
  end_date date,
  status text default 'past',
  description text,
  image_url text,
  url text,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists art_exhibitions_client_year_idx on public.art_exhibitions(client_id, year desc);

-- 3. RLS — public read, authenticated write
alter table public.art_works enable row level security;
alter table public.art_exhibitions enable row level security;

drop policy if exists "art_works_read" on public.art_works;
create policy "art_works_read" on public.art_works for select using (true);
drop policy if exists "art_works_write" on public.art_works;
create policy "art_works_write" on public.art_works for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "art_exhibitions_read" on public.art_exhibitions;
create policy "art_exhibitions_read" on public.art_exhibitions for select using (true);
drop policy if exists "art_exhibitions_write" on public.art_exhibitions;
create policy "art_exhibitions_write" on public.art_exhibitions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4. Storage bucket — art-images (public)
insert into storage.buckets (id, name, public)
values ('art-images', 'art-images', true)
on conflict (id) do nothing;

drop policy if exists "art_images_read" on storage.objects;
create policy "art_images_read" on storage.objects for select using (bucket_id = 'art-images');
drop policy if exists "art_images_write" on storage.objects;
create policy "art_images_write" on storage.objects for insert with check (bucket_id = 'art-images' and auth.role() = 'authenticated');
drop policy if exists "art_images_delete" on storage.objects;
create policy "art_images_delete" on storage.objects for delete using (bucket_id = 'art-images' and auth.role() = 'authenticated');

-- 5. Darek-klient
insert into public.clients (id, slug, name, industry, primary_color, resource_module, public_url)
values (
  '00000000-0000-0000-0000-000000000002',
  'darek',
  'Darek Uhrberg',
  'Konst',
  '#1a1a1a',
  'art',
  'https://darekuhrberg.se'
)
on conflict (id) do update set
  resource_module = excluded.resource_module,
  primary_color = excluded.primary_color,
  public_url = excluded.public_url;
