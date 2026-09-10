-- Build both composition-selector catalogs once per day. Storefront requests
-- only read the prepared JSON and never execute the aggregation pipeline.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.gift_selector_catalog_cache (
  collection text primary key check (collection in ('baskets', 'boxes')),
  payload jsonb not null,
  refreshed_at timestamptz not null default now()
);

alter table private.gift_selector_catalog_cache enable row level security;
revoke all on private.gift_selector_catalog_cache from public, anon, authenticated;

create or replace function private.refresh_gift_selector_catalog_cache()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_baskets jsonb;
  v_boxes jsonb;
begin
  v_baskets := public.get_gift_selector_catalog_for('baskets');
  v_boxes := public.get_gift_selector_catalog_for('boxes');

  insert into private.gift_selector_catalog_cache (collection, payload, refreshed_at)
  values
    ('baskets', v_baskets, now()),
    ('boxes', v_boxes, now())
  on conflict (collection) do update
  set payload = excluded.payload,
      refreshed_at = excluded.refreshed_at;
end;
$$;

revoke all on function private.refresh_gift_selector_catalog_cache() from public;
select private.refresh_gift_selector_catalog_cache();

create or replace function public.get_gift_selector_cached_catalog(p_collection text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select c.payload
  from private.gift_selector_catalog_cache c
  where c.collection = p_collection
    and p_collection in ('baskets', 'boxes');
$$;

create or replace function public.get_gift_selector_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_gift_selector_cached_catalog('baskets');
$$;

create or replace function public.get_gift_box_selector_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_gift_selector_cached_catalog('boxes');
$$;

revoke all on function public.get_gift_selector_cached_catalog(text) from public;
revoke all on function public.get_gift_selector_catalog() from public;
revoke all on function public.get_gift_box_selector_catalog() from public;
grant execute on function public.get_gift_selector_cached_catalog(text) to anon, authenticated;
grant execute on function public.get_gift_selector_catalog() to anon, authenticated;
grant execute on function public.get_gift_box_selector_catalog() to anon, authenticated;

comment on function public.get_gift_selector_cached_catalog(text) is
  'Returns the latest prepared basket or box composition-selector catalog.';
comment on function public.get_gift_selector_catalog() is
  'Returns the prepared daily gift-basket selector catalog.';
comment on function public.get_gift_box_selector_catalog() is
  'Returns the prepared daily gift-box selector catalog.';

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'refresh-gift-selector-catalog-daily';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'refresh-gift-selector-catalog-daily',
    '40 5 * * *',
    'select private.refresh_gift_selector_catalog_cache()'
  );
end;
$$;

