-- A product filter Alias is an RPC key embedded in article HTML. It is not
-- necessarily the Tilda article slug, so navigation must use a separately
-- verified published URL and omit filters that do not have one.

alter table public.article_product_filters
  add column if not exists article_url text;

comment on column public.article_product_filters.article_url is
  'Published Tilda article URL verified by import-articles-index from data-alias.';

create index if not exists article_product_filters_article_url_idx
  on public.article_product_filters (article_url)
  where article_url is not null;

-- These aliases existed before the articles were publicly available. Do not
-- expose guessed URLs: import-articles-index will populate article_url only
-- after the corresponding data-alias is found on a published sitemap page.
update public.article_product_filters
set article_url = null,
    updated_at = now()
where alias in (
  'cheese-in-gift-baskets',
  'camembert-v-podarochnyh-korzinah',
  'brie-v-podarochnyh-korzinah',
  'gorgonzola-v-podarochnyh-korzinah',
  'rockforo-v-podarochnyh-korzinah',
  'maasdam-v-podarochnyh-korzinah',
  'parmezan-v-podarochnyh-korzinah',
  'cheddar-v-podarochnyh-korzinah',
  'gauda-v-podarochnyh-korzinah',
  'blue-cheese-v-podarochnyh-korzinah',
  'podarochnye-korziny-s-syrom',
  'kamamber-v-podarochnykh-korzinakh',
  'gorgonzola-v-podarochnykh-korzinakh',
  'rokfor-v-podarochnykh-korzinakh'
);

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

  with navigation as (
    select
      f.alias,
      f.title,
      f.article_url,
      f.cluster_order
    from public.article_product_filters f
    where f.enabled = true
      and f.cluster_key = v_rule.cluster_key
      and f.alias <> v_rule.alias
      and f.article_url ~
        '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$'
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
          'title',
            case
              when n.alias = 'podarochnye-korziny-s-syrom'
                then 'Все материалы о сырах в подарочных корзинах'
              else n.title
            end,
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
$$;

comment on function public.get_article_products(text) is
  'Returns cached products and only verified published article navigation URLs.';

revoke all on function public.get_article_products(text) from public;
grant execute on function public.get_article_products(text) to anon, authenticated;
