create table if not exists public.product_variants (
  variant_key text primary key,
  product_key text not null references public.products_catalog(product_key) on delete cascade,
  edition_uid text not null,
  group_id text,
  option_name text,
  option_value text,
  title text,
  url text,
  image text,
  images jsonb not null default '[]'::jsonb,
  price numeric,
  old_price numeric,
  available boolean not null default true,
  raw jsonb,
  updated_at timestamptz not null default now(),
  constraint product_variants_edition_uid_not_blank check (length(trim(edition_uid)) > 0),
  constraint product_variants_images_array check (jsonb_typeof(images) = 'array')
);

create index if not exists product_variants_product_key_idx
  on public.product_variants (product_key);

create index if not exists product_variants_available_product_price_idx
  on public.product_variants (product_key, price)
  where available is true;

alter table public.product_variants enable row level security;
revoke all on public.product_variants from anon, authenticated;

create or replace function public.neuromaria_search_products_v2(
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
  category_slug text
)
language sql
stable
security definer
set search_path = public, pg_temp
set statement_timeout = '2s'
as $$
  with input as (
    select
      trim(search_query) as original,
      lower(translate(trim(search_query), 'Ёё', 'Ее')) as normalized
  ),
  candidates as (
    select
      v.variant_key,
      p.product_key,
      v.group_id,
      v.option_name,
      v.option_value,
      coalesce(v.title, p.title) as title,
      coalesce(v.url, p.url) as url,
      coalesce(v.image, p.image) as image,
      coalesce(v.price, p.price) as price,
      p.category_slug,
      case
        when v.url = i.original or v.variant_key = i.original then 0
        when lower(translate(coalesce(v.title, p.title, ''), 'Ёё', 'Ее')) = i.normalized then 1
        when lower(translate(coalesce(v.title, p.title, ''), 'Ёё', 'Ее')) like i.normalized || '%' then 2
        when lower(translate(coalesce(v.title, p.title, ''), 'Ёё', 'Ее')) like '%' || i.normalized || '%' then 3
        else 4
      end as rank
    from public.product_variants v
    join public.products_catalog p on p.product_key = v.product_key
    cross join input i
    where p.available is true
      and v.available is true
      and length(i.original) between 2 and 200
      and (
        v.url = i.original
        or v.variant_key = i.original
        or p.product_key = i.original
        or lower(translate(coalesce(v.title, p.title, ''), 'Ёё', 'Ее')) like '%' || replace(replace(i.normalized, '%', '\%'), '_', '\_') || '%' escape '\'
        or lower(translate(coalesce(p.description, ''), 'Ёё', 'Ее')) like '%' || replace(replace(i.normalized, '%', '\%'), '_', '\_') || '%' escape '\'
        or lower(translate(coalesce(p.composition, ''), 'Ёё', 'Ее')) like '%' || replace(replace(i.normalized, '%', '\%'), '_', '\_') || '%' escape '\'
      )
      and concat_ws(' ', v.title, p.description, p.composition, p.category_slug) !~* '(алкогол|вино|шампан|просекко|коньяк|виски|ром|лик[её]р|текил|джин|водк)'
    union all
    select
      p.product_key as variant_key,
      p.product_key,
      null::text as group_id,
      null::text as option_name,
      null::text as option_value,
      p.title,
      p.url,
      p.image,
      p.price,
      p.category_slug,
      case
        when p.url = i.original or p.product_key = i.original then 0
        when lower(translate(coalesce(p.title, ''), 'Ёё', 'Ее')) = i.normalized then 1
        when lower(translate(coalesce(p.title, ''), 'Ёё', 'Ее')) like i.normalized || '%' then 2
        when lower(translate(coalesce(p.title, ''), 'Ёё', 'Ее')) like '%' || i.normalized || '%' then 3
        else 4
      end as rank
    from public.products_catalog p
    cross join input i
    where p.available is true
      and not exists (select 1 from public.product_variants v where v.product_key = p.product_key and v.available is true)
      and length(i.original) between 2 and 200
      and (
        p.url = i.original
        or p.product_key = i.original
        or lower(translate(coalesce(p.title, ''), 'Ёё', 'Ее')) like '%' || replace(replace(i.normalized, '%', '\%'), '_', '\_') || '%' escape '\'
        or lower(translate(coalesce(p.description, ''), 'Ёё', 'Ее')) like '%' || replace(replace(i.normalized, '%', '\%'), '_', '\_') || '%' escape '\'
        or lower(translate(coalesce(p.composition, ''), 'Ёё', 'Ее')) like '%' || replace(replace(i.normalized, '%', '\%'), '_', '\_') || '%' escape '\'
      )
      and concat_ws(' ', p.title, p.description, p.composition, p.category_slug) !~* '(алкогол|вино|шампан|просекко|коньяк|виски|ром|лик[её]р|текил|джин|водк)'
  )
  select c.variant_key, c.product_key, c.group_id, c.option_name, c.option_value,
         c.title, c.url, c.image, c.price, c.category_slug
  from candidates c
  order by c.rank, c.price nulls last, c.variant_key
  limit least(greatest(coalesce(result_limit, 8), 1), 12);
$$;

revoke all on function public.neuromaria_search_products_v2(text, integer) from public;
grant execute on function public.neuromaria_search_products_v2(text, integer) to anon, authenticated, service_role;

comment on table public.product_variants is
  'YML editions such as product sizes. Base products_catalog keys remain stable for analytics and SEO.';

comment on function public.neuromaria_search_products_v2(text, integer) is
  'Bounded RLS-safe NeuroMaria catalog search with е/ё normalization and product editions.';
