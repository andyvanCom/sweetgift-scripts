-- Complete classification coverage for active articles and available products.

create or replace function public.assign_missing_article_seo_topics()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_matched integer := 0;
  v_fallback integer := 0;
begin
  with candidates as (
    select
      a.article_key,
      q.topic_title,
      row_number() over (
        partition by a.article_key
        order by length(q.query_text) desc, q.id
      ) as position
    from public.articles_index a
    join public.seo_topic_queries q
      on lower(concat_ws(' ', a.title, a.description, a.article_key))
         like '%' || lower(trim(q.query_text)) || '%'
    where a.is_active = true
      and nullif(trim(a.seo_topic_title), '') is null
      and length(trim(q.query_text)) >= 5
      and nullif(trim(q.topic_title), '') is not null
  ), updated as (
    update public.articles_index a
    set seo_topic_title = c.topic_title,
        updated_at = now()
    from candidates c
    where c.position = 1
      and a.article_key = c.article_key
    returning a.article_key
  )
  select count(*) into v_matched from updated;

  with updated as (
    update public.articles_index a
    set seo_topic_title = left(
          trim(regexp_replace(lower(coalesce(a.title, a.article_key)),
            '[^[:alnum:]а-яё -]+', ' ', 'gi')),
          160
        ),
        updated_at = now()
    where a.is_active = true
      and nullif(trim(a.seo_topic_title), '') is null
    returning a.article_key
  )
  select count(*) into v_fallback from updated;

  return jsonb_build_object(
    'ok', true,
    'matched_to_semantic_core', v_matched,
    'title_fallback', v_fallback,
    'remaining_without_topic', (
      select count(*)
      from public.articles_index
      where is_active = true and nullif(trim(seo_topic_title), '') is null
    )
  );
end;
$$;

revoke all on function public.assign_missing_article_seo_topics() from public;
grant execute on function public.assign_missing_article_seo_topics() to service_role;

create or replace function public.refresh_product_seo_entities_all()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_types integer := 0;
  v_ingredients integer := 0;
  v_styles integer := 0;
  v_prices integer := 0;
begin
  insert into public.product_seo_entities (
    product_key, entity_type, entity_value, weight, updated_at
  )
  select
    p.product_key,
    'product_type',
    case
      when lower(concat_ws(' ', p.category_slug, p.title)) like '%клубник%' then 'клубника в шоколаде'
      when lower(concat_ws(' ', p.category_slug, p.title)) like '%букет%' then 'букет'
      when lower(concat_ws(' ', p.category_slug, p.title)) like '%корзин%' then 'подарочная корзина'
      when lower(concat_ws(' ', p.category_slug, p.title)) like '%гастр%' then 'гастрономический набор'
      when lower(concat_ws(' ', p.category_slug, p.title)) like '%набор%' then 'подарочный набор'
      else 'подарок'
    end,
    180,
    now()
  from public.products_catalog p
  where p.available = true
  on conflict (product_key, entity_type, entity_value)
  do update set weight = excluded.weight, updated_at = excluded.updated_at;
  get diagnostics v_product_types = row_count;

  insert into public.product_seo_entities (
    product_key, entity_type, entity_value, weight, updated_at
  )
  select distinct
    p.product_key,
    'ingredient',
    pi.tag,
    100,
    now()
  from public.products_catalog p
  join public.product_ingredients pi on pi.product_key = p.product_key
  where p.available = true and nullif(trim(pi.tag), '') is not null
  on conflict (product_key, entity_type, entity_value)
  do update set weight = excluded.weight, updated_at = excluded.updated_at;
  get diagnostics v_ingredients = row_count;

  insert into public.product_seo_entities (
    product_key, entity_type, entity_value, weight, updated_at
  )
  select distinct p.product_key, 'style', styles.entity_value, 90, now()
  from public.products_catalog p
  cross join lateral (
    values
      ('безалкогольный', lower(concat_ws(' ', p.title, p.description, p.category_slug)) like '%безалкогол%'),
      ('гастрономический', lower(concat_ws(' ', p.title, p.description, p.category_slug)) ~ 'гастр|корзин|деликатес'),
      ('сладкий', lower(concat_ws(' ', p.title, p.description, p.composition)) ~ 'шоколад|конфет|слад|десерт'),
      ('мясной', lower(concat_ws(' ', p.title, p.description, p.composition)) ~ 'мяс|колбас|паштет|хамон'),
      ('сырный', lower(concat_ws(' ', p.title, p.description, p.composition)) ~ 'сыр|камамбер|бри|горгонзол')
  ) as styles(entity_value, matches)
  where p.available = true and styles.matches
  on conflict (product_key, entity_type, entity_value)
  do update set weight = excluded.weight, updated_at = excluded.updated_at;
  get diagnostics v_styles = row_count;

  insert into public.product_seo_entities (
    product_key, entity_type, entity_value, weight, updated_at
  )
  select
    p.product_key,
    'price_segment',
    case
      when coalesce(p.price, 0) < 3000 then 'до 3000 рублей'
      when p.price < 7000 then '3000–7000 рублей'
      when p.price < 15000 then '7000–15000 рублей'
      else 'премиум'
    end,
    70,
    now()
  from public.products_catalog p
  where p.available = true and p.price is not null
  on conflict (product_key, entity_type, entity_value)
  do update set weight = excluded.weight, updated_at = excluded.updated_at;
  get diagnostics v_prices = row_count;

  return jsonb_build_object(
    'ok', true,
    'product_types_upserted', v_product_types,
    'ingredients_upserted', v_ingredients,
    'styles_upserted', v_styles,
    'price_segments_upserted', v_prices,
    'remaining_without_entities', (
      select count(*)
      from public.products_catalog p
      where p.available = true
        and not exists (
          select 1 from public.product_seo_entities e
          where e.product_key = p.product_key
        )
    )
  );
end;
$$;

revoke all on function public.refresh_product_seo_entities_all() from public;
grant execute on function public.refresh_product_seo_entities_all() to service_role;
