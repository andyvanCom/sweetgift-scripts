create or replace function public.miniapp_search_products_v1(
  search_query text,
  result_limit integer default 20
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
set search_path = ''
set statement_timeout = '2s'
as $$
  with input as (
    select
      trim(search_query) as original,
      lower(translate(trim(search_query), 'Ёё', 'Ее')) as normalized,
      replace(replace(lower(translate(trim(search_query), 'Ёё', 'Ее')), '%', '\%'), '_', '\_') as pattern
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
        when v.url = i.original or v.variant_key = i.original or p.product_key = i.original then 0
        when lower(translate(coalesce(v.title, p.title, ''), 'Ёё', 'Ее')) = i.normalized then 1
        when lower(translate(coalesce(v.title, p.title, ''), 'Ёё', 'Ее')) like i.pattern || '%' escape '\' then 2
        else 3
      end as rank
    from public.product_variants v
    join public.products_catalog p on p.product_key = v.product_key
    cross join input i
    where p.available is true
      and v.available is true
      and length(i.original) between 2 and 120
      and (
        v.url = i.original
        or v.variant_key = i.original
        or p.product_key = i.original
        or lower(translate(coalesce(v.title, p.title, ''), 'Ёё', 'Ее')) like '%' || i.pattern || '%' escape '\'
      )
    union all
    select
      p.product_key,
      p.product_key,
      null::text,
      null::text,
      null::text,
      p.title,
      p.url,
      p.image,
      p.price,
      p.category_slug,
      case
        when p.url = i.original or p.product_key = i.original then 0
        when lower(translate(coalesce(p.title, ''), 'Ёё', 'Ее')) = i.normalized then 1
        when lower(translate(coalesce(p.title, ''), 'Ёё', 'Ее')) like i.pattern || '%' escape '\' then 2
        else 3
      end
    from public.products_catalog p
    cross join input i
    where p.available is true
      and not exists (
        select 1 from public.product_variants v
        where v.product_key = p.product_key and v.available is true
      )
      and length(i.original) between 2 and 120
      and (
        p.url = i.original
        or p.product_key = i.original
        or lower(translate(coalesce(p.title, ''), 'Ёё', 'Ее')) like '%' || i.pattern || '%' escape '\'
      )
  )
  select c.variant_key, c.product_key, c.group_id, c.option_name, c.option_value,
         c.title, c.url, c.image, c.price, c.category_slug
  from candidates c
  order by c.rank, c.price nulls last, c.variant_key
  limit least(greatest(coalesce(result_limit, 20), 1), 20);
$$;

revoke all on function public.miniapp_search_products_v1(text, integer)
  from public, anon, authenticated;
grant execute on function public.miniapp_search_products_v1(text, integer)
  to anon, authenticated, service_role;

comment on function public.miniapp_search_products_v1(text, integer) is
  'Bounded title-only search over public available catalog products for the SweetGift mini app.';
