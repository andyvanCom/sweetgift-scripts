-- Configure the 100-article Coffee SEO cluster through the existing
-- article_product_filters -> article_product_cache -> get_article_products()
-- pipeline. Pairings use mandatory groups separated by &&. Product traits
-- that are absent from the catalog fall back to the real coffee ingredient.

create or replace function public.sync_coffee_article_filters(p_articles jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coffee text := 'кофе';
  v_beans text :=
    'кофе в зернах|кофе зернов|зерновой кофе|зернового кофе';
  v_ground text :=
    'молотый кофе|молотого кофе|кофе молотый|кофе молотого';
  v_instant text := 'растворимый кофе|кофе растворимый';
  v_italian text :=
    'кофе illy|кофе в зернах. illy|кофе bialetti|молотый кофе bialetti';
  v_honey text :=
    'мед натуральный|мёд натуральный|мед цветоч|мёд цветоч|мед суфле|мёд суфле|крем мед|крем мёд|крем-мед|крем-мёд|медовый десерт|орехи в меду|орехи в мёду';
  v_cheese text :=
    'камамбер|camembert|сыр бри|сыр brie|горгонзол|gorgonzol|рокфор|rockforo|roquefort|дорблю|dorblu|blue cheese|маасдам|масдам|чеддер|чеддар|cheddar|пармезан|parmigiano|гауда|gouda|грюйер|gruy|сыр качотта|сыр с голубой плесенью';
  v_nuts text :=
    'миндал|фундук|лесной орех|грецк|гретск|кешью|кедров|арахис|фисташ|пекан|орехи в скорлупе|орехи россыпью|смесь орехов|ассорти орехов';
  v_fruit text :=
    'яблок|груш|виноград|инжир|апельсин|мандарин|манго|ананас|персик|абрикос|клубник|малина|ежевик';
  v_dried_fruit text := 'сухофрукт|финик|курага|чернослив|изюм';
  v_meat text :=
    'колбас|мясо|паштет|риет|хамон|карпаччо|осетр|осётр|олени|лось|кабан|медвеж|бобр|деликатес';
  v_premium text :=
    'икра|краб|осетр|осётр|фуа-гра|фуагра|трюфел|хамон|лосос|форель|белуга';
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
    where lower(trim(x.alias)) = any (
      regexp_split_to_array(trim($aliases$
kofe-v-podarochnoy-korzine-kak-vybrat-udachnyy-sostav
podarochnye-korziny-s-kofe
kofe-v-podarok-kak-vybrat
zernovoy-kofe-v-podarok
molotyy-kofe-v-podarok
rastvorimyy-kofe-v-podarochnom-nabore
arabika-vkus-proishozhdenie-i-vybor-dlya-podarka
robusta-osobennosti-vkusa-i-kreposti
arabika-i-robusta-v-chem-raznitsa
kofeynyy-blend-kak-vybrat-smes
monosort-kofe-chto-eto-takoe
kofe-sredney-obzharki
kofe-svetloy-obzharki
kofe-temnoy-obzharki
stepeni-obzharki-kofe-kak-vybrat
kofe-s-shokoladnymi-notami
kofe-s-orehovymi-notami
kofe-s-karamelnymi-notami
kofe-s-fruktovymi-notami
kofe-s-yagodnymi-notami
kofe-s-tsitrusovymi-notami
kofe-bez-kislinki-kak-vybrat
krepkiy-kofe-kakoy-vybrat
myagkiy-kofe-sorta-i-obzharka
aromatnyy-kofe-v-podarok
premialnyy-kofe-v-podarok
italyanskiy-kofe-v-podarok
brazilskiy-kofe-vkus-i-osobennosti
kolumbiyskiy-kofe-vkus-i-osobennosti
efiopskiy-kofe-vkus-i-osobennosti
keniyskiy-kofe-vkus-i-osobennosti
kofe-iz-tsentralnoy-ameriki
kofe-iz-azii-osobennosti-vkusa
kak-vybrat-kofe-v-zernah
kak-vybrat-molotyy-kofe
kak-hranit-kofe-v-zernah
kak-hranit-molotyy-kofe
srok-hraneniya-kofe
pochemu-kofe-teryaet-aromat
kak-ponyat-chto-kofe-svezhiy
kak-vybrat-pomol-kofe
kofe-dlya-turki
kofe-dlya-french-pressa
kofe-dlya-geyzernoy-kofevarki
kofe-dlya-rozhkovoy-kofevarki
kofe-dlya-kapelnoy-kofevarki
kofe-dlya-espresso
kofe-dlya-amerikano
kofe-dlya-kapuchino
kofe-dlya-latte
kofe-i-shokolad-luchshie-sochetaniya
kofe-i-temnyy-shokolad
kofe-i-molochnyy-shokolad
kofe-i-belyy-shokolad
kofe-i-orehi
kofe-i-mindal
kofe-i-funduk
kofe-i-keshyu
kofe-i-fistashki
kofe-i-med
kofe-i-syr
kofe-i-frukty
kofe-i-suhofrukty
kofe-i-pechene
kofe-i-konfety
kofe-i-martsipan
kofe-i-karamel
kofe-i-myasnye-delikatesy-v-podarochnoy-korzine
chto-polozhit-v-podarochnyy-nabor-s-kofe
kak-sobrat-kofeynuyu-podarochnuyu-korzinu
kofeynyy-podarochnyy-boks
malenkiy-podarok-s-kofe
bolshaya-podarochnaya-korzina-s-kofe
premialnaya-korzina-s-kofe
kofe-v-podarok-muzhchine
kofeynaya-korzina-dlya-muzhchiny
kofe-v-podarok-zhenschine
kofeynaya-korzina-dlya-zhenschiny
kofe-v-podarok-rukovoditelyu
kofe-v-podarok-direktoru
kofe-v-podarok-nachalniku
kofe-v-podarok-kollege
kofe-v-podarok-sotrudnikam
korporativnye-podarki-s-kofe
kofe-v-podarok-partneram
kofe-v-podarok-klientam
kofe-na-den-rozhdeniya-v-podarok
kofe-na-novyy-god-v-podarok
novogodnyaya-korzina-s-kofe
kofe-v-podarok-na-23-fevralya
kofe-v-podarok-na-8-marta
kofe-v-podarok-uchitelyu
kofe-v-podarok-vrachu
kofe-v-podarok-seme
chto-podarit-lyubitelyu-kofe
originalnyy-podarok-s-kofe
vkusnyy-podarok-s-kofe
nabor-kofe-i-shokolad-v-podarok
nabor-kofe-i-orehi-v-podarok
nabor-kofe-i-med-v-podarok
$aliases$), '\s+')
    )
      and trim(x.url) ~
        '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$'
  ),
  classified as (
    select
      s.*,
      case
        when s.alias in (
          'zernovoy-kofe-v-podarok',
          'kak-vybrat-kofe-v-zernah',
          'kak-hranit-kofe-v-zernah'
        ) then v_beans
        when s.alias in (
          'molotyy-kofe-v-podarok',
          'kak-vybrat-molotyy-kofe',
          'kak-hranit-molotyy-kofe'
        ) then v_ground
        when s.alias = 'rastvorimyy-kofe-v-podarochnom-nabore' then
          v_instant
        when s.alias = 'kofe-temnoy-obzharki' then
          'кофе illy темная обжарка|illy темная обжарка в зернах'
        when s.alias = 'italyanskiy-kofe-v-podarok' then v_italian
        else v_coffee
      end as coffee_filter,
      case
        when s.alias in (
          'kofe-i-shokolad-luchshie-sochetaniya',
          'nabor-kofe-i-shokolad-v-podarok'
        ) then 'шоколад'
        when s.alias = 'kofe-i-temnyy-shokolad' then
          'темный шоколад|тёмный шоколад|шоколад темный|шоколад тёмный|горький шоколад|шоколад горький'
        when s.alias = 'kofe-i-molochnyy-shokolad' then
          'молочный шоколад|шоколад молочный'
        when s.alias = 'kofe-i-belyy-shokolad' then
          'белый шоколад|шоколад белый|белом шоколаде|белого шоколада'
        when s.alias in (
          'kofe-i-orehi',
          'nabor-kofe-i-orehi-v-podarok'
        ) then v_nuts
        when s.alias = 'kofe-i-mindal' then 'миндал'
        when s.alias = 'kofe-i-funduk' then 'фундук|лесной орех'
        when s.alias = 'kofe-i-keshyu' then 'кешью'
        -- No coffee + pistachio basket currently exists: use the safe
        -- general coffee fallback instead of publishing an empty block.
        when s.alias = 'kofe-i-fistashki' then null
        when s.alias in ('kofe-i-med', 'nabor-kofe-i-med-v-podarok') then
          v_honey
        when s.alias = 'kofe-i-syr' then v_cheese
        when s.alias = 'kofe-i-frukty' then v_fruit
        when s.alias = 'kofe-i-suhofrukty' then v_dried_fruit
        when s.alias = 'kofe-i-pechene' then 'печенье|бискотти'
        when s.alias = 'kofe-i-konfety' then 'конфет'
        when s.alias = 'kofe-i-martsipan' then 'марципан'
        when s.alias = 'kofe-i-karamel' then 'карамел'
        when s.alias =
          'kofe-i-myasnye-delikatesy-v-podarochnoy-korzine' then v_meat
        when s.alias in (
          'premialnyy-kofe-v-podarok',
          'premialnaya-korzina-s-kofe',
          'kofe-v-podarok-rukovoditelyu',
          'kofe-v-podarok-direktoru',
          'kofe-v-podarok-nachalniku'
        ) then v_premium
        when s.alias in (
          'kofe-v-podarok-muzhchine',
          'kofeynaya-korzina-dlya-muzhchiny',
          'kofe-v-podarok-na-23-fevralya'
        ) then v_meat || '|' || v_cheese || '|' || v_nuts
        when s.alias in (
          'kofe-v-podarok-zhenschine',
          'kofeynaya-korzina-dlya-zhenschiny',
          'kofe-v-podarok-na-8-marta'
        ) then 'шоколад|конфет|печенье|' || v_fruit || '|' || v_honey || '|' || v_cheese
        when s.alias = 'kofe-v-podarok-kollege' then
          'шоколад|конфет|печенье|чай|' || v_nuts
        when s.alias in (
          'kofe-v-podarok-sotrudnikam',
          'korporativnye-podarki-s-kofe'
        ) then 'шоколад|конфет|печенье|чай'
        when s.alias in (
          'kofe-v-podarok-partneram',
          'kofe-v-podarok-klientam'
        ) then v_premium || '|' || v_cheese || '|' || v_meat
        else null
      end as secondary_filter,
      case
        when s.alias in (
          'kofe-v-podarok-muzhchine',
          'kofeynaya-korzina-dlya-muzhchiny',
          'kofe-v-podarok-na-23-fevralya'
        ) then 'coffee-men'
        when s.alias in (
          'kofe-v-podarok-zhenschine',
          'kofeynaya-korzina-dlya-zhenschiny',
          'kofe-v-podarok-na-8-marta'
        ) then 'coffee-women'
        when s.alias in (
          'premialnyy-kofe-v-podarok',
          'premialnaya-korzina-s-kofe',
          'kofe-v-podarok-rukovoditelyu',
          'kofe-v-podarok-direktoru',
          'kofe-v-podarok-nachalniku'
        ) then 'coffee-executive'
        when s.alias = 'kofe-v-podarok-kollege' then 'coffee-colleague'
        when s.alias in (
          'kofe-v-podarok-sotrudnikam',
          'korporativnye-podarki-s-kofe'
        ) then 'coffee-employees'
        when s.alias in (
          'kofe-v-podarok-partneram',
          'kofe-v-podarok-klientam'
        ) then 'coffee-partners'
        when s.alias ~ 'kofe-i-|nabor-kofe-i-' then 'coffee-pairings'
        when s.alias ~
          'zernovoy|molotyy|rastvorimyy|arabika|robusta|blend|monosort|obzhark|italyanskiy|brazilskiy|kolumbiyskiy|efiopskiy|keniyskiy|tsentralnoy-ameriki|iz-azii' then
          'coffee-types'
        when s.alias ~
          'notami|kislinki|krepkiy|myagkiy|aromatnyy' then 'coffee-taste'
        when s.alias ~
          'kak-hranit|srok-hraneniya|teryaet-aromat|svezhiy|pomol|dlya-turki|french-pressa|kofevarki|dlya-espresso|dlya-amerikano|dlya-kapuchino|dlya-latte' then
          'coffee-guides'
        when s.alias ~
          'den-rozhdeniya|novyy-god|novogod|uchitelyu|vrachu|seme' then
          'coffee-occasions'
        else 'coffee-gifts'
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
        when c.secondary_filter is null then c.coffee_filter
        else c.coffee_filter || '&&' || c.secondary_filter
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
    alias, filter_type, filter_value, title, subtitle, limit_count, enabled,
    cluster_key, cluster_order, article_url
  )
  select
    p.alias,
    p.filter_type,
    p.filter_value,
    p.title,
    case p.cluster_key
      when 'coffee-pairings' then
        'Корзины SweetGift с кофе и выбранным сочетанием'
      when 'coffee-types' then
        'Корзины SweetGift с подходящим видом кофе'
      when 'coffee-taste' then 'Подарочные корзины SweetGift с кофе'
      when 'coffee-guides' then
        'Доступные подарочные корзины SweetGift с кофе'
      when 'coffee-men' then
        'Гастрономические подарочные корзины SweetGift с кофе для мужчин'
      when 'coffee-women' then
        'Сладкие, фруктовые и премиальные корзины SweetGift с кофе'
      when 'coffee-executive' then
        'Премиальные и статусные подарочные корзины SweetGift с кофе'
      when 'coffee-colleague' then
        'Универсальные подарочные корзины SweetGift с кофе для коллег'
      when 'coffee-employees' then
        'Корпоративные подарочные корзины SweetGift с кофе'
      when 'coffee-partners' then
        'Премиальные деловые корзины SweetGift с кофе'
      when 'coffee-occasions' then
        'Подарочные корзины SweetGift с кофе к празднику'
      else 'Популярные подарочные корзины SweetGift с кофе'
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

revoke all on function public.sync_coffee_article_filters(jsonb) from public;
grant execute on function public.sync_coffee_article_filters(jsonb)
  to service_role;

-- Seed filters for articles imported before this migration. The function
-- itself keeps only the explicit 100-Alias whitelist above.
select public.sync_coffee_article_filters(
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

comment on function public.sync_coffee_article_filters(jsonb) is
  'Upserts the 100 published Coffee article filters using real catalog traits.';
