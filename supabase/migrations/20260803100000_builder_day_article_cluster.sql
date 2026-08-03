-- Configure the published Builder's Day SEO cluster through the existing
-- article_product_filters -> article_product_cache -> get_article_products()
-- pipeline. Builder/recipient attributes are not invented as product tags;
-- each intent maps to a safe profile of real structured ingredients, while
-- the existing popularity score continues to rank matching baskets.

create or replace function public.sync_builder_day_article_filters(
  p_articles jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_general text :=
    'сыр|колбас|мясо|паштет|риет|хамон|карпаччо|кофе|чай|шоколад|конфет|печенье|орех|миндал|фундук|кешью|мед|мёд|джем|яблок|груш|виноград|ананас|манго|клубник';
  v_men text :=
    'колбас|мясо|паштет|риет|хамон|карпаччо|осетр|олени|лось|кабан|медвеж|бобр&&кофе|чай';
  v_women text :=
    'фрукт|яблок|груш|виноград|ананас|манго|клубник|малина|ежевик&&шоколад|конфет|печенье|камамбер|сыр бри|мед|мёд|чай';
  v_executive text :=
    'икра|краб|осетр|осётр|фуа-гра|фуагра|трюфел|хамон|лосос|форель|белуга';
  v_colleague text :=
    'кофе|чай&&шоколад|конфет|печенье|сыр|орех|миндал|фундук|кешью|мед|мёд|джем';
  v_employees text :=
    'кофе|чай|шоколад|конфет|печенье|мармелад';
  v_partners text :=
    'сыр&&хамон|икра|осетр|осётр|краб|кофе|чай|оливки|маслины|трюфел';
  v_original text :=
    'медвеж|олени|лось|кабан|бобр|краб|икра|трюфел|фуа-гра|фуагра|кокос|питахай|папай|мангостин|экзот';
  v_rows bigint := 0;
begin
  if jsonb_typeof(coalesce(p_articles, '[]'::jsonb)) <> 'array' then
    raise exception 'p_articles must be a JSON array';
  end if;

  with source as (
    select distinct
      lower(trim(x.alias)) as alias,
      nullif(trim(x.title), '') as title,
      trim(x.url) as article_url
    from jsonb_to_recordset(coalesce(p_articles, '[]'::jsonb))
      as x(alias text, title text, url text)
    where lower(trim(x.alias)) = any (array[
      'podarok-na-den-stroitelya-idei-i-gotovye-podarochnye-korziny',
      'podarok-na-den-stroitelya-muzhchine',
      'podarok-rukovoditelyu-na-den-stroitelya',
      'podarok-direktoru-na-den-stroitelya',
      'idei-podarkov-na-den-stroitelya',
      'korporativnye-podarki-na-den-stroitelya',
      'podarok-muzhchine-stroitelyu-na-den-rozhdeniya',
      'podarok-kollege-na-den-stroitelya',
      'originalnyy-podarok-na-den-stroitelya',
      'podarok-muzhu-na-den-stroitelya',
      'podarok-dlya-stroitelya-na-den-rozhdeniya',
      'podarki-partneram-na-den-stroitelya',
      'podarok-nachalniku-na-den-stroitelya',
      'kakie-podarki-podarit-na-den-stroitelya',
      'vip-podarki-na-den-stroitelya',
      'podarki-sotrudnikam-na-den-stroitelya',
      'originalnyy-podarok-muzhchinam-na-den-stroitelya',
      'prikolnye-podarki-na-den-stroitelya',
      'kupit-podarok-na-den-stroitelya',
      'varianty-podarkov-na-den-stroitelya',
      'podarok-zhenschine-na-den-stroitelya',
      'podarok-parnyu-na-den-stroitelya',
      'podarok-muzhu-stroitelyu-na-den-rozhdeniya',
      'idei-podarka-rukovoditelyu-na-den-stroitelya',
      'podarki-rabotnikam-na-den-stroitelya',
      'primery-podarkov-na-den-stroitelya',
      'luchshiy-podarok-muzhchine-na-den-stroitelya',
      'podarok-dedushke-stroitelyu',
      'vkusnyy-podarok-direktoru-na-den-stroitelya',
      'podarochnye-korziny-na-den-stroitelya'
    ]::text[])
      and trim(x.url) ~
        '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$'
  ),
  classified as (
    select
      s.*,
      case
        when s.alias = 'podarok-zhenschine-na-den-stroitelya' then
          'builder-women'
        when s.alias in (
          'podarok-rukovoditelyu-na-den-stroitelya',
          'podarok-direktoru-na-den-stroitelya',
          'podarok-nachalniku-na-den-stroitelya',
          'idei-podarka-rukovoditelyu-na-den-stroitelya',
          'vip-podarki-na-den-stroitelya',
          'vkusnyy-podarok-direktoru-na-den-stroitelya'
        ) then 'builder-executive'
        when s.alias = 'podarok-kollege-na-den-stroitelya' then
          'builder-colleague'
        when s.alias in (
          'korporativnye-podarki-na-den-stroitelya',
          'podarki-sotrudnikam-na-den-stroitelya',
          'podarki-rabotnikam-na-den-stroitelya'
        ) then 'builder-employees'
        when s.alias = 'podarki-partneram-na-den-stroitelya' then
          'builder-partners'
        when s.alias in (
          'originalnyy-podarok-na-den-stroitelya',
          'originalnyy-podarok-muzhchinam-na-den-stroitelya',
          'prikolnye-podarki-na-den-stroitelya'
        ) then 'builder-original'
        when s.alias in (
          'podarok-na-den-stroitelya-muzhchine',
          'podarok-muzhchine-stroitelyu-na-den-rozhdeniya',
          'podarok-muzhu-na-den-stroitelya',
          'podarok-parnyu-na-den-stroitelya',
          'podarok-muzhu-stroitelyu-na-den-rozhdeniya',
          'luchshiy-podarok-muzhchine-na-den-stroitelya',
          'podarok-dedushke-stroitelyu'
        ) then 'builder-men'
        else 'builder-general'
      end as cluster_key
    from source s
  ),
  prepared as (
    select
      c.alias,
      coalesce(c.title, initcap(replace(c.alias, '-', ' '))) as title,
      c.article_url,
      c.cluster_key,
      case c.cluster_key
        when 'builder-men' then v_men
        when 'builder-women' then v_women
        when 'builder-executive' then v_executive
        when 'builder-colleague' then v_colleague
        when 'builder-employees' then v_employees
        when 'builder-partners' then v_partners
        when 'builder-original' then v_original
        else v_general
      end as filter_value
    from classified c
  ),
  ordered as (
    select
      p.*,
      row_number() over (
        partition by p.cluster_key
        order by p.alias
      )::integer as cluster_order
    from prepared p
  )
  insert into public.article_product_filters (
    alias,
    filter_type,
    filter_value,
    title,
    subtitle,
    limit_count,
    enabled,
    cluster_key,
    cluster_order,
    article_url
  )
  select
    p.alias,
    case
      when position('&&' in p.filter_value) > 0 then
        'ingredient_all_contains'
      else 'ingredient_contains'
    end,
    p.filter_value,
    p.title,
    case p.cluster_key
      when 'builder-men' then
        'Гастрономические подарочные корзины SweetGift для мужчин'
      when 'builder-women' then
        'Фруктовые, сырные и сладкие подарочные корзины SweetGift'
      when 'builder-executive' then
        'Премиальные и статусные подарочные корзины SweetGift'
      when 'builder-colleague' then
        'Универсальные подарочные корзины SweetGift для коллег'
      when 'builder-employees' then
        'Универсальные корпоративные подарочные корзины SweetGift'
      when 'builder-partners' then
        'Деловые подарочные корзины SweetGift для партнёров'
      when 'builder-original' then
        'Необычные подарочные корзины SweetGift с деликатесами'
      else 'Популярные подарочные корзины SweetGift с продуктами'
    end,
    12,
    true,
    p.cluster_key,
    p.cluster_order,
    p.article_url
  from ordered p
  on conflict (alias) do update
  set
    filter_type = excluded.filter_type,
    filter_value = excluded.filter_value,
    title = excluded.title,
    subtitle = excluded.subtitle,
    limit_count = excluded.limit_count,
    enabled = excluded.enabled,
    cluster_key = excluded.cluster_key,
    cluster_order = excluded.cluster_order,
    article_url = excluded.article_url,
    updated_at = now();

  get diagnostics v_rows = row_count;

  return jsonb_build_object('ok', true, 'filters', v_rows);
end;
$$;

revoke all on function public.sync_builder_day_article_filters(jsonb)
  from public;
grant execute on function public.sync_builder_day_article_filters(jsonb)
  to service_role;

-- Seed already indexed articles. The function keeps only the explicit
-- 30-Alias whitelist above.
select public.sync_builder_day_article_filters(
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'alias', regexp_replace(a.url, '^.*/', ''),
        'title', a.title,
        'url', a.url
      )
    ),
    '[]'::jsonb
  )
)
from public.articles_index a
where a.is_active = true
  and a.url ~ '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$';

comment on function public.sync_builder_day_article_filters(jsonb) is
  'Upserts the 30 published Builder Day article profiles without fake product tags.';
