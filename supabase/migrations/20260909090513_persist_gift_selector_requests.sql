create table if not exists public.gift_selector_requests (
  request_id text primary key,
  created_at timestamptz not null default now(),
  request_type text not null check (request_type in ('basket', 'gift_box')),
  ingredients text[] not null check (cardinality(ingredients) between 1 and 30),
  quantity integer not null check (quantity between 1 and 10000),
  budget numeric(12, 2) not null check (budget between 500 and 10000000),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  comment text not null default '',
  page_url text not null default '',
  admin_email_status text not null default 'pending'
    check (admin_email_status in ('pending', 'sent', 'failed')),
  customer_email_status text not null default 'pending'
    check (customer_email_status in ('pending', 'sent', 'failed')),
  last_email_error text
);

alter table public.gift_selector_requests enable row level security;

revoke all on table public.gift_selector_requests from public, anon, authenticated;
grant all on table public.gift_selector_requests to service_role;

create index if not exists gift_selector_requests_created_at_idx
  on public.gift_selector_requests (created_at desc);

comment on table public.gift_selector_requests is
  'Private durable inbox for custom basket and gift-box selector requests.';
