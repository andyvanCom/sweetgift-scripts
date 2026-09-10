-- Return only the current result page from the prepared daily catalog.
-- This keeps storefront responses small while preserving exact ingredient matching.

create or replace function public.get_gift_selector_cached_selection(
  p_collection text,
  p_ingredients jsonb default '[]'::jsonb,
  p_limit integer default 24
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with source as (
    select c.payload
    from private.gift_selector_catalog_cache c
    where c.collection = p_collection
      and p_collection in ('baskets', 'boxes')
  ),
  selected as (
    select lower(replace(trim(value), 'ё', 'е')) as name
    from jsonb_array_elements_text(coalesce(p_ingredients, '[]'::jsonb))
  ),
  matched as (
    select product
    from source s
    cross join lateral jsonb_array_elements(s.payload->'products') product
    where not exists (
      select 1
      from selected wanted
      where not exists (
        select 1
        from jsonb_array_elements_text(coalesce(product->'ingredients', '[]'::jsonb)) actual(value)
        where lower(replace(trim(actual.value), 'ё', 'е')) = wanted.name
      )
    )
  ),
  ranked as (
    select product
    from matched
    order by coalesce((product->>'popularity_score')::numeric, 0) desc,
             coalesce((product->>'price')::numeric, 999999999) asc,
             product->>'title'
    limit greatest(1, least(coalesce(p_limit, 24), 48))
  )
  select jsonb_build_object(
    'ingredients', coalesce((select payload->'ingredients' from source), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(product) from ranked), '[]'::jsonb),
    'total', (select count(*) from matched)
  );
$$;

revoke all on function public.get_gift_selector_cached_selection(text, jsonb, integer) from public;
grant execute on function public.get_gift_selector_cached_selection(text, jsonb, integer) to anon, authenticated;

comment on function public.get_gift_selector_cached_selection(text, jsonb, integer) is
  'Returns a small matching page from the prepared daily composition-selector catalog.';
