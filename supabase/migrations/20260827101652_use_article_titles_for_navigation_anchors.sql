-- Navigation anchors must describe the destination article, not the product
-- selection attached to it. Every published article URL currently has one
-- active, unique title in articles_index.
create or replace function public.get_article_products(article_alias text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
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

  with navigation as (
    select
      f.alias,
      article.title,
      f.article_url,
      f.cluster_order
    from public.article_product_filters f
    cross join lateral (
      select a.title
      from public.articles_index a
      where a.is_active = true
        and rtrim(a.url, '/') = rtrim(f.article_url, '/')
        and nullif(btrim(a.title), '') is not null
      order by a.updated_at desc, a.id desc
      limit 1
    ) article
    where f.enabled = true
      and f.cluster_key = v_rule.cluster_key
      and f.alias <> v_rule.alias
      and f.article_url ~
        '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$'
    order by f.cluster_order, article.title
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
          'matched_ingredients', c.matched_ingredients,
          'popularity', c.popularity_score
        )
        order by c.rank
      )
      from public.article_product_cache c
      join public.products_catalog p on p.product_key = c.product_key
      where c.article_alias = v_rule.alias
        and p.available = true
    ), '[]'::jsonb),
    'navigation', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'alias', n.alias,
          'title', n.title,
          'url', n.article_url
        )
        order by n.cluster_order, n.title
      )
      from navigation n
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$;

comment on function public.get_article_products(text) is
  'Returns cached products and published article navigation with destination article titles.';

revoke all on function public.get_article_products(text) from public;
grant execute on function public.get_article_products(text) to anon, authenticated;
