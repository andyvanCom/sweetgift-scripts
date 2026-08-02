-- Configure the published nut SEO cluster through the existing
-- article_product_filters -> article_product_cache -> get_article_products()
-- pipeline. Product combinations use mandatory groups separated by &&.

create or replace function public.sync_nut_article_filters(p_articles jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuts text :=
    'миндал|фундук|лесной орех|лесного орех|грецк|гретск|кешью|кедровый орех|кедровые орех|кедровым орех|арахис|фисташ|пекан|кокос|кульки с орехами|орехи в скорлупе|орехи россыпью|смесь орехов|смесь из орехов|ассорти орехов|набор орехов|ореховое ассорти|ореховая смесь|орехи в меду|орехи в мёду|орехи в шоколаде|финики с орехами|сухофрукты с орехами';
  v_honey text :=
    'мед натуральный|мёд натуральный|мед цветоч|мёд цветоч|мед суфле|мёд суфле|мед-суфле|мёд-суфле|крем мед|крем мёд|крем-мед|крем-мёд|медовый десерт|орехи в меду|орехи в мёду';
  v_cheese text :=
    'камамбер|camembert|сыр бри|сыр brie|горгонзол|gorgonzol|рокфор|rockforo|roquefort|дорблю|dorblu|blue cheese|маасдам|масдам|чеддер|чеддар|cheddar|пармезан|parmigiano|гауда|gouda|грюйер|gruy|сыр качотта|сыр с голубой плесенью';
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
      'orehi-v-podarochnyh-korzinah',
      'mindal-polza-vkus-i-podarochnye-sochetaniya',
      'funduk-polza-vkus-i-podarochnye-sochetaniya',
      'lesnoy-oreh-v-podarochnoy-korzine',
      'gretskiy-oreh-polza-i-sochetaniya',
      'keshyu-polza-vkus-i-podarochnye-sochetaniya',
      'kedrovye-orehi-v-podarochnoy-korzine',
      'arahis-v-podarochnyh-naborah',
      'fistashki-polza-i-podarochnye-sochetaniya',
      'pekan-vkus-polza-i-sochetaniya',
      'kokos-v-podarochnoy-korzine',
      'orehovoe-assorti-v-podarochnoy-korzine',
      'smes-orehov-kak-vybrat-dlya-podarka',
      'orehi-v-shokolade',
      'mindal-v-shokolade',
      'funduk-v-shokolade',
      'arahis-v-shokolade',
      'fistashki-v-shokolade',
      'orehi-v-mede',
      'mindal-v-mede',
      'funduk-v-mede',
      'keshyu-v-mede',
      'kedrovye-orehi-v-mede',
      'solenye-orehi-v-podarochnoy-korzine',
      'pryanye-orehi-v-podarochnoy-korzine',
      'zharenye-orehi-v-podarochnom-nabore',
      'suhofrukty-s-orehami',
      'finiki-s-orehami',
      'kuraga-s-orehami',
      'chernosliv-s-orehami',
      'orehi-i-syr-luchshie-sochetaniya',
      'mindal-i-syr',
      'funduk-i-syr',
      'gretskiy-oreh-i-syr',
      'keshyu-i-syr',
      'fistashki-i-syr',
      'pekan-i-syr',
      'orehi-i-med-udachnye-sochetaniya',
      'orehi-i-shokolad',
      'orehi-i-kofe',
      'orehi-i-chay',
      'orehi-i-frukty',
      'orehi-i-yabloki',
      'orehi-i-grusha',
      'orehi-i-vinograd',
      'orehi-i-inzhir',
      'orehi-i-myasnye-delikatesy',
      'kakie-orehi-dobavit-v-podarochnuyu-korzinu',
      'kak-vybrat-orehi-dlya-podarka',
      'kak-hranit-orehi-doma',
      'srok-hraneniya-orehov',
      'kak-ponyat-chto-orehi-svezhie',
      'syrye-ili-zharenye-orehi-chto-vybrat',
      'solenye-ili-nesolenye-orehi-dlya-podarka',
      'mindal-ili-keshyu-chto-vybrat',
      'funduk-ili-gretskiy-oreh-chto-vybrat',
      'fistashki-ili-pekan-chto-vybrat',
      'kedrovye-orehi-ili-keshyu-chto-vybrat',
      'polza-mindalya',
      'polza-funduka',
      'polza-gretskogo-oreha',
      'polza-keshyu',
      'polza-kedrovyh-orehov',
      'polza-arahisa',
      'polza-fistashek',
      'polza-pekana',
      'polza-kokosa',
      'pochemu-orehi-horosho-darit',
      'podarochnaya-korzina-s-orehami',
      'podarochnyy-nabor-s-orehami',
      'orehovyy-podarok-muzhchine',
      'orehovyy-podarok-zhenschine',
      'orehovyy-podarok-rukovoditelyu',
      'orehovyy-podarok-kollege',
      'korporativnye-podarki-s-orehami',
      'premialnaya-korzina-s-orehami',
      'orehi-v-podarochnyh-naborah-dlya-muzhchin',
      'orehi-v-podarochnyh-naborah-dlya-zhenschin',
      'orehovyy-nabor-na-den-rozhdeniya',
      'orehovaya-korzina-na-yubiley',
      'orehi-v-podarok-na-novyy-god',
      'novogodnyaya-korzina-s-orehami',
      'orehovyy-podarok-na-23-fevralya',
      'orehovyy-podarok-na-8-marta',
      'orehi-v-podarok-uchitelyu',
      'orehi-v-podarok-vrachu',
      'chto-podarit-lyubitelyu-orehov',
      'kak-sobrat-orehovuyu-korzinu',
      'chto-polozhit-v-podarochnyy-nabor-s-orehami',
      'orehi-i-syr-v-podarok',
      'orehi-i-med-v-podarok',
      'orehi-i-shokolad-v-podarok',
      'orehi-i-kofe-v-podarok',
      'orehi-i-chay-v-podarok',
      'orehi-i-suhofrukty-v-podarok',
      'fruktovaya-korzina-s-orehami',
      'syrnaya-korzina-s-orehami',
      'myasnaya-korzina-s-orehami',
      'malenkiy-podarochnyy-boks-s-orehami',
      'bolshaya-podarochnaya-korzina-s-orehami'
    ]::text[])
      and trim(x.url) ~
        '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$'
  ),
  classified as (
    select
      s.*,
      case
        when s.alias ~ 'mindal' then 'миндал'
        when s.alias ~ 'funduk|lesnoy-oreh' then
          'фундук|лесной орех|лесного орех'
        when s.alias ~ 'gretskiy|gretskogo' then 'грецк|гретск'
        when s.alias ~ 'keshyu' then 'кешью'
        when s.alias ~ 'kedrov' then
          'кедровый орех|кедровые орех|кедровым орех|кедровый грильяж'
        when s.alias ~ 'arahis' then 'арахис'
        when s.alias ~ 'fistash' then 'фисташ'
        when s.alias ~ 'pekan' then 'пекан'
        when s.alias ~ 'kokos' then 'кокос'
        when s.alias in (
          'orehovoe-assorti-v-podarochnoy-korzine',
          'smes-orehov-kak-vybrat-dlya-podarka'
        ) then
          'смесь орехов|смесь из орехов|ассорти орехов|набор орехов|ореховое ассорти|ореховая смесь|орехи россыпью|орехи в скорлупе'
        else v_nuts
      end as nut_filter,
      case
        when s.alias ~ '(^|-)v-shokolade$|orehi-i-shokolad' then 'шоколад'
        when s.alias ~ '(^|-)v-mede$|orehi-i-med' then v_honey
        when s.alias ~ '(^|-)i-syr($|-)|syrnaya-korzina' then v_cheese
        when s.alias ~ '(^|-)i-kofe($|-)' then 'кофе'
        when s.alias ~ '(^|-)i-chay($|-)' then 'чай'
        when s.alias ~ '(^|-)i-yabloki($|-)' then 'яблок'
        when s.alias ~ '(^|-)i-grusha($|-)' then 'груш'
        when s.alias ~ '(^|-)i-vinograd($|-)' then 'виноград'
        when s.alias ~ '(^|-)i-inzhir($|-)' then 'инжир'
        when s.alias ~ '(^|-)i-frukty($|-)|fruktovaya-korzina' then
          'яблок|груш|виноград|инжир|апельсин|мандарин|манго|ананас|персик|абрикос'
        when s.alias ~ 'suhofrukty-s-orehami|orehi-i-suhofrukty' then
          'сухофрукт|финик|курага|чернослив|изюм'
        when s.alias = 'finiki-s-orehami' then 'финик'
        when s.alias = 'kuraga-s-orehami' then 'курага|сухофрукт'
        when s.alias = 'chernosliv-s-orehami' then 'чернослив|сухофрукт'
        when s.alias ~ 'myasnye-delikatesy|myasnaya-korzina' then
          'колбас|мясо|паштет|риет|хамон|карпаччо|деликатес'
        when s.alias = 'solenye-orehi-v-podarochnoy-korzine' then
          'солен|солён'
        when s.alias = 'pryanye-orehi-v-podarochnoy-korzine' then
          'пряная смесь|пряные орех'
        when s.alias = 'zharenye-orehi-v-podarochnom-nabore' then
          'жарен|обжарен'
        else null
      end as secondary_filter,
      case
        when s.alias ~
          'v-shokolade|v-mede|solenye-orehi|pryanye-orehi|zharenye-orehi|assorti|smes-orehov|suhofrukty-s-orehami|finiki-s-orehami|kuraga-s-orehami|chernosliv-s-orehami' then
          'nut-products'
        when s.alias ~
          '(^|-)i-(syr|med|shokolad|kofe|chay|frukty|yabloki|grusha|vinograd|inzhir|myasnye|suhofrukty)($|-)|fruktovaya-korzina|syrnaya-korzina|myasnaya-korzina' then
          'nut-pairings'
        when s.alias ~
          'v-podarok|podarok-|podarki|korporativ|muzhchin|zhenschin|rukovoditelyu|kollege|uchitelyu|vrachu|den-rozhdeniya|yubiley|novogod|23-fevralya|8-marta' then
          'nut-gifts'
        when s.alias ~
          'mindal|funduk|lesnoy-oreh|gretskiy|gretskogo|keshyu|kedrov|arahis|fistash|pekan|kokos' then
          'nut-species'
        else 'nut-guides'
      end as cluster_key
    from source s
  ),
  prepared as (
    select
      c.alias,
      coalesce(c.title, initcap(replace(c.alias, '-', ' '))) as title,
      c.article_url,
      case
        when c.secondary_filter is null then 'ingredient_contains'
        else 'ingredient_all_contains'
      end as filter_type,
      case
        when c.secondary_filter is null then c.nut_filter
        else c.nut_filter || '&&' || c.secondary_filter
      end as filter_value,
      c.cluster_key
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
    p.filter_type,
    p.filter_value,
    p.title,
    case p.cluster_key
      when 'nut-products' then
        'Корзины SweetGift с выбранным ореховым продуктом'
      when 'nut-pairings' then
        'Корзины SweetGift с орехами и подходящими сочетаниями'
      when 'nut-gifts' then
        'Подарочные корзины SweetGift с орехами'
      when 'nut-species' then
        'Корзины SweetGift с выбранным видом орехов'
      else 'Подарочные корзины и наборы SweetGift с орехами'
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

revoke all on function public.sync_nut_article_filters(jsonb) from public;
grant execute on function public.sync_nut_article_filters(jsonb)
  to service_role;

-- Seed filters for articles that were imported before this migration. The
-- synchronization function itself keeps only the explicit cluster whitelist.
select public.sync_nut_article_filters(
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

comment on function public.sync_nut_article_filters(jsonb) is
  'Upserts exact nut article filters, cluster navigation and published URLs.';
