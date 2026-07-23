-- Improve "Похожие композиции": composition is the primary signal, price
-- proximity is secondary, category is a small bonus, popularity breaks ties.

create or replace function public.refresh_product_card_seo_blocks_one(
  p_product_key text,
  p_limit integer default 6
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lists jsonb;
  v_ingredient_articles jsonb;
  v_similar_products jsonb;
  v_blocks jsonb;
begin
  -- 1. Входит в списки
  with lists_data as (
    select
      tl.slug,
      max(tl.title) as title,
      max(tl.url) as url,
      max(tl.description) as description,
      min(tli.rank) as min_rank
    from public.top_list_items tli
    join public.top_lists tl on tl.slug = tli.list_slug
    where tli.product_key = p_product_key
    group by tl.slug
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title', title,
        'url', url,
        'description', description
      )
      order by min_rank asc
    ),
    '[]'::jsonb
  )
  into v_lists
  from lists_data;

  -- 2. Советы и статьи по квотам
  with product_type_articles as (
    select distinct on (ai.article_key)
      ai.article_key,
      ai.title,
      ai.url,
      ai.description,
      ai.updated_at,
      1 as block_order,
      pse.weight + ase.weight as score
    from public.product_seo_entities pse
    join public.article_seo_entities ase
      on ase.entity_type = pse.entity_type
     and ase.entity_value = pse.entity_value
    join public.articles_index ai on ai.article_key = ase.article_key
    where pse.product_key = p_product_key
      and pse.entity_type = 'product_type'
      and ai.is_active = true
    order by ai.article_key, pse.weight + ase.weight desc
  ),
  product_type_limited as (
    select *
    from product_type_articles
    order by score desc, md5(p_product_key || article_key)
    limit 2
  ),
  recipient_articles as (
    select distinct on (ai.article_key)
      ai.article_key,
      ai.title,
      ai.url,
      ai.description,
      ai.updated_at,
      2 as block_order,
      pse.weight + ase.weight as score
    from public.product_seo_entities pse
    join public.article_seo_entities ase
      on ase.entity_type = pse.entity_type
     and ase.entity_value = pse.entity_value
    join public.articles_index ai on ai.article_key = ase.article_key
    where pse.product_key = p_product_key
      and pse.entity_type = 'recipient'
      and ai.is_active = true
      and ai.article_key not in (select article_key from product_type_limited)
    order by ai.article_key, pse.weight + ase.weight desc
  ),
  recipient_limited as (
    select *
    from recipient_articles
    order by score desc, md5(p_product_key || article_key)
    limit 2
  ),
  occasion_articles as (
    select distinct on (ai.article_key)
      ai.article_key,
      ai.title,
      ai.url,
      ai.description,
      ai.updated_at,
      3 as block_order,
      pse.weight + ase.weight as score
    from public.product_seo_entities pse
    join public.article_seo_entities ase
      on ase.entity_type = pse.entity_type
     and ase.entity_value = pse.entity_value
    join public.articles_index ai on ai.article_key = ase.article_key
    where pse.product_key = p_product_key
      and pse.entity_type in ('occasion', 'age', 'style')
      and ai.is_active = true
      and ai.article_key not in (select article_key from product_type_limited)
      and ai.article_key not in (select article_key from recipient_limited)
    order by ai.article_key, pse.weight + ase.weight desc
  ),
  occasion_limited as (
    select *
    from occasion_articles
    order by score desc, md5(p_product_key || article_key)
    limit 2
  ),
  all_articles as (
    select * from product_type_limited
    union all
    select * from recipient_limited
    union all
    select * from occasion_limited
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title', title,
        'url', url,
        'description', description,
        'score', score,
        'block_order', block_order
      )
      order by block_order asc, score desc, md5(p_product_key || article_key)
    ),
    '[]'::jsonb
  )
  into v_ingredient_articles
  from all_articles;

  -- 3. Похожие композиции
  with product_data as (
    select
      product_key,
      category_slug,
      price
    from public.products_catalog
    where product_key = p_product_key
    limit 1
  ),
  product_tags as (
    select distinct tag
    from public.product_ingredients
    where product_key = p_product_key
      and nullif(trim(tag), '') is not null
  ),
  product_tag_count as (
    select count(*)::numeric as tag_count
    from product_tags
  ),
  candidate_tags as (
    select
      pi.product_key,
      count(distinct pi.tag)::numeric as tag_count,
      count(distinct pi.tag) filter (
        where pi.tag in (select tag from product_tags)
      )::numeric as common_count
    from public.product_ingredients pi
    where nullif(trim(pi.tag), '') is not null
    group by pi.product_key
  ),
  scored as (
    select
      pc.product_key,
      pc.title,
      pc.url,
      pc.image,
      pc.price,
      coalesce(ps.popularity_score, 0) as popularity_score,
      ct.common_count,
      round(
        60 * ct.common_count /
        nullif(ptc.tag_count + ct.tag_count - ct.common_count, 0),
        2
      ) as composition_score,
      case
        when pd.price is null or pd.price <= 0
          or pc.price is null or pc.price <= 0 then 0
        when abs(pc.price - pd.price) / pd.price <= 0.10 then 25
        when abs(pc.price - pd.price) / pd.price <= 0.20 then 18
        when abs(pc.price - pd.price) / pd.price <= 0.35 then 10
        else 0
      end as price_score,
      case when pc.category_slug = pd.category_slug then 10 else 0 end
        as category_score
    from public.products_catalog pc
    cross join product_data pd
    cross join product_tag_count ptc
    join candidate_tags ct on ct.product_key = pc.product_key
    left join public.products_stats ps on ps.product_key = pc.product_key
    where pc.product_key <> p_product_key
      and pc.available = true
      and ct.common_count > 0
  ),
  similar_data as (
    select
      product_key,
      title,
      url,
      image,
      price,
      popularity_score,
      common_count,
      composition_score,
      price_score,
      category_score,
      composition_score + price_score + category_score as score
    from scored
    order by
      score desc,
      composition_score desc,
      popularity_score desc,
      price asc nulls last
    limit p_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title', title,
        'url', url,
        'image', image,
        'price', price
      )
      order by
        score desc,
        composition_score desc,
        popularity_score desc,
        price asc nulls last
    ),
    '[]'::jsonb
  )
  into v_similar_products
  from similar_data;

  v_blocks := jsonb_build_array(
    jsonb_build_object(
      'type', 'chips',
      'title', 'Входит в списки',
      'items', v_lists
    ),
    jsonb_build_object(
      'type', 'links',
      'title', 'Советы и статьи',
      'items', v_ingredient_articles
    ),
    jsonb_build_object(
      'type', 'products',
      'title', 'Похожие композиции',
      'items', v_similar_products
    )
  );

  insert into public.product_card_seo_blocks (
    product_key,
    lists,
    ingredient_articles,
    similar_products,
    blocks,
    updated_at
  )
  values (
    p_product_key,
    v_lists,
    v_ingredient_articles,
    v_similar_products,
    v_blocks,
    now()
  )
  on conflict (product_key)
  do update set
    lists = excluded.lists,
    ingredient_articles = excluded.ingredient_articles,
    similar_products = excluded.similar_products,
    blocks = excluded.blocks,
    updated_at = now();

  return jsonb_build_object(
    'product_key', p_product_key,
    'blocks', v_blocks
  );
end;
$$;

comment on function public.refresh_product_card_seo_blocks_one(text, integer) is
  'Refreshes product card SEO blocks; similar products use Jaccard ingredient similarity, price proximity, category and popularity.';
