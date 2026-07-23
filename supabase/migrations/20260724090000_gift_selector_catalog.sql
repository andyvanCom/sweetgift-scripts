-- One-request public catalog for /podbor-po-sostavu.
-- Uses the existing YML catalog and normalized ingredient tags.

create or replace function public.get_gift_selector_catalog()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with available_products as (
    select
      p.product_key,
      p.title,
      p.url,
      p.image,
      p.price,
      p.composition
    from public.products_catalog p
    where p.available = true
  ),
  normalized_ingredients as (
    select distinct
      pi.product_key,
      lower(regexp_replace(trim(pi.tag), '\s+', ' ', 'g')) as ingredient
    from public.product_ingredients pi
    join available_products p on p.product_key = pi.product_key
    where nullif(trim(pi.tag), '') is not null
  ),
  product_ingredient_lists as (
    select
      product_key,
      array_agg(ingredient order by ingredient) as ingredients
    from normalized_ingredients
    group by product_key
  ),
  popularity as (
    select
      e.product_key,
      sum(
        case e.event_type
          when 'purchase' then 10
          when 'add_to_cart' then 4
          when 'favorite' then 3
          when 'listing_click' then 2
          when 'view' then 1
          else 0
        end
      )::bigint as popularity_score
    from public.product_events e
    join available_products p on p.product_key = e.product_key
    group by e.product_key
  ),
  ingredient_counts as (
    select
      ingredient,
      count(distinct product_key)::integer as product_count
    from normalized_ingredients
    group by ingredient
  )
  select jsonb_build_object(
    'ingredients',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', ingredient,
            'product_count', product_count
          )
          order by ingredient
        )
        from ingredient_counts
      ),
      '[]'::jsonb
    ),
    'products',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'product_key', p.product_key,
            'title', p.title,
            'url', p.url,
            'image', p.image,
            'price', p.price,
            'composition', p.composition,
            'ingredients', i.ingredients,
            'popularity_score', coalesce(s.popularity_score, 0)
          )
          order by coalesce(s.popularity_score, 0) desc, p.price asc nulls last, p.title
        )
        from available_products p
        join product_ingredient_lists i on i.product_key = p.product_key
        left join popularity s on s.product_key = p.product_key
      ),
      '[]'::jsonb
    )
  );
$$;

comment on function public.get_gift_selector_catalog() is
  'Returns available SweetGift products and canonical ingredient tags for one-request client filtering.';

revoke all on function public.get_gift_selector_catalog() from public;
grant execute on function public.get_gift_selector_catalog() to anon, authenticated;
