-- The built site catalogue, one row per product page. Separate from the master
-- `products` table in this same project (3,641 rows, written by the awards and
-- link pipeline in the data repo), which this table must never be confused with.
-- Plain `create table`, not `if not exists`: a name collision fails loudly.
create table site_products (
  id               text primary key,
  slug             text unique not null,
  brand            text not null,
  name             text not null,
  category         text,
  subcategory      text,
  region           text,
  price            numeric,
  image            text,
  image_cutout     boolean,
  buy_link         text,
  top_award        text,
  award_count      integer,
  consensus_count  integer,
  awards_won       jsonb default '[]'::jsonb,
  data             jsonb not null,
  updated_at       timestamptz default now()
);

create index site_products_category_idx  on site_products (category);
create index site_products_consensus_idx on site_products (consensus_count desc);
create index site_products_slug_idx      on site_products (slug);

-- Public read, no public write. The service role writes.
alter table site_products enable row level security;
create policy "public read" on site_products for select using (true);
