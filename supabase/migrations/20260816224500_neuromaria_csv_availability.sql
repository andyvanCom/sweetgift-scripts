create or replace function public.neuromaria_product_availability(product_key_input text)
returns table(
  availability_status text,
  lead_days integer,
  available_from date
)
language sql
stable
security definer
set search_path = public, pg_temp
set statement_timeout = '1s'
as $$
  with parent as (
    select r.tilda_uid
    from public.tilda_catalog_csv_rows r
    where r.active is true
      and r.parent_uid is null
      and regexp_replace(regexp_replace(coalesce(r.url, ''), '^https?://[^/]+', ''), '\?.*$', '') = product_key_input
    limit 1
  ), stocked as (
    select r.*,
           case
             when r.editions ~* 'Предзаказ\s*:\s*В наличии' then 0
             when r.editions ~* 'Предзаказ\s*:\s*[0-9]+\s*(день|дня|дней)'
               then substring(r.editions from '([0-9]+)')::integer
             else null
           end as days
    from public.tilda_catalog_csv_rows r
    join parent p on p.tilda_uid = r.parent_uid
    where r.active is true
      and (r.unlimited is true or coalesce(r.quantity, 0) > 0)
  ), resolved as (
    select min(days) as days from stocked where days is not null
  )
  select
    case
      when not exists (select 1 from parent) then 'unknown'
      when resolved.days = 0 then 'in_stock'
      when resolved.days > 0 then 'preorder'
      else 'unavailable'
    end,
    resolved.days,
    case when resolved.days is not null
      then (now() at time zone 'Europe/Moscow')::date + resolved.days
      else null
    end
  from resolved;
$$;

revoke all on function public.neuromaria_product_availability(text) from public, anon, authenticated;
grant execute on function public.neuromaria_product_availability(text) to service_role;

create or replace function public.neuromaria_search_products_v3(
  search_query text,
  result_limit integer default 8
)
returns table(
  variant_key text,
  product_key text,
  group_id text,
  option_name text,
  option_value text,
  title text,
  url text,
  image text,
  price numeric,
  category_slug text,
  availability_status text,
  lead_days integer,
  available_from date
)
language sql
stable
security definer
set search_path = public, pg_temp
set statement_timeout = '3s'
as $$
  select p.variant_key, p.product_key, p.group_id, p.option_name, p.option_value,
         p.title, p.url, p.image, p.price, p.category_slug,
         a.availability_status, a.lead_days, a.available_from
  from public.neuromaria_search_products_v2(search_query, result_limit) p
  cross join lateral public.neuromaria_product_availability(p.product_key) a
  where a.availability_status <> 'unavailable';
$$;

revoke all on function public.neuromaria_search_products_v3(text, integer) from public;
grant execute on function public.neuromaria_search_products_v3(text, integer) to anon, authenticated, service_role;

comment on function public.neuromaria_search_products_v3(text, integer) is
  'NeuroMaria catalog search enriched with authoritative Tilda CSV stock and preorder lead time.';
