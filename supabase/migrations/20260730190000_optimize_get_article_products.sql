-- Keep the existing get_article_products(article_alias) contract while making
-- pipe-separated ingredient filters fast enough for the public PostgREST
-- statement timeout. MATERIALIZED prevents PostgreSQL from re-evaluating the
-- filter split for every product ingredient row.

update public.article_product_filters
set
  filter_type = 'tag',
  filter_value = 'cheese',
  updated_at = now()
where alias = 'cheese-in-gift-baskets';

create or replace function public.get_article_products(article_alias text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rule public.article_product_filters%rowtype;
  v_result jsonb;
begin
  if article_alias is null
     or length(article_alias) > 200
     or article_alias !~ '^[a-z0-9][a-z0-9-]*$' then
    return null;
  end if;

  select *
  into v_rule
  from public.article_product_filters
  where alias = article_alias
    and enabled = true;

  if not found then
    return null;
  end if;

  with
  needles as materialized (
    select lower(trim(value)) as value
    from regexp_split_to_table(v_rule.filter_value, '\s*\|\s*') as parts(value)
    where nullif(trim(value), '') is not null
  ),
  matched_products as materialized (
    select
      p.product_key,
      p.title,
      p.url,
      p.image,
      p.price,
      p.composition,
      p.category_slug,
      max(
        case
          when v_rule.filter_type = 'ingredient_contains'
               and lower(trim(coalesce(pi.ingredient_raw, ''))) = n.value
            then 100
          when v_rule.filter_type = 'ingredient_contains'
               and position(n.value in lower(coalesce(pi.ingredient_raw, ''))) = 1
            then 90
          when v_rule.filter_type = 'ingredient_contains' then 80
          else 50
        end
      ) as match_precision,
      array_agg(distinct pi.ingredient_raw)
        filter (where pi.ingredient_raw is not null) as matched_ingredients
    from public.product_ingredients pi
    join public.products_catalog p on p.product_key = pi.product_key
    join needles n on
      (
        v_rule.filter_type = 'tag'
        and lower(trim(coalesce(pi.tag, ''))) = n.value
        and lower(coalesce(pi.ingredient_raw, '')) !~ 'сырокоп|сыровял'
      )
      or (
        v_rule.filter_type = 'ingredient'
        and lower(trim(coalesce(pi.ingredient_raw, ''))) = n.value
      )
      or (
        v_rule.filter_type = 'ingredient_contains'
        and (
          position(n.value in lower(coalesce(pi.ingredient_raw, ''))) > 0
          or position(n.value in lower(coalesce(pi.ingredient_normalized, ''))) > 0
        )
      )
    where p.available = true
      and (
        lower(coalesce(p.category_slug, '')) ~ '(korzin|basket)'
        or (
          lower(coalesce(p.category_slug, '')) in ('', 'tproduct')
          and (
            lower(coalesce(p.title, '')) like '%корзин%'
            or lower(coalesce(p.product_key, '')) like '%korzin%'
          )
        )
      )
    group by
      p.product_key,
      p.title,
      p.url,
      p.image,
      p.price,
      p.composition,
      p.category_slug
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
    join matched_products m on m.product_key = e.product_key
    group by e.product_key
  ),
  ordered_products as (
    select
      m.*,
      coalesce(pop.popularity_score, 0) as popularity_score
    from matched_products m
    left join popularity pop on pop.product_key = m.product_key
    order by
      case when v_rule.filter_type = 'tag' then 0 else m.match_precision end desc,
      coalesce(pop.popularity_score, 0) desc,
      m.price asc nulls last,
      m.title asc
    limit v_rule.limit_count
  ),
  navigation as (
    select
      f.alias,
      f.title,
      f.cluster_order
    from public.article_product_filters f
    where f.enabled = true
      and f.cluster_key = v_rule.cluster_key
      and f.alias <> v_rule.alias
    order by f.cluster_order, f.title
  )
  select jsonb_build_object(
    'alias', v_rule.alias,
    'title', v_rule.title,
    'subtitle', v_rule.subtitle,
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_key', p.product_key,
          'title', p.title,
          'url', p.url,
          'price', p.price,
          'image', p.image,
          'composition', p.composition,
          'matched_ingredients', p.matched_ingredients,
          'popularity', p.popularity_score
        )
        order by
          case when v_rule.filter_type = 'tag' then 0 else p.match_precision end desc,
          p.popularity_score desc,
          p.price asc nulls last,
          p.title
      )
      from ordered_products p
    ), '[]'::jsonb),
    'navigation', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'alias', n.alias,
          'title',
            case
              when n.alias = 'podarochnye-korziny-s-syrom'
                then 'Все материалы о сырах в подарочных корзинах'
              else n.title
            end,
          'url', '/stati/' || n.alias
        )
        order by n.cluster_order, n.title
      )
      from navigation n
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_article_products(text) is
  'Returns configured available gift baskets and cluster navigation for one Tilda article alias.';

revoke all on function public.get_article_products(text) from public;
grant execute on function public.get_article_products(text) to anon, authenticated;
