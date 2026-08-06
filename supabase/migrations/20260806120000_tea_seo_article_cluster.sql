-- Configure the published 100-article Tea SEO cluster through the existing
-- article_product_filters -> article_product_cache -> get_article_products()
-- pipeline. Pairings use mandatory groups separated by &&. The base tea
-- filter contains only observed product wording and therefore cannot match
-- unrelated words such as `вручайте`.

create or replace function public.sync_tea_article_filters(p_articles jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tea text :=
    'чай basilur|чай базилур|чай базелюр|чай chabo|чай в баночке chabo|чай chabo в баночке|чай dilmah|чай hampstead|чай riston|чай подарочный riston|чай chelton|чай hilltop|чай nadin|черный чай|чёрный чай|чай черный|чай чёрный|зеленый чай|зелёный чай|чай зеленый|чай зелёный|белый чай|жасминовый чай|травяной чай|чай травяной|зимний черный чай';
  v_honey text :=
    'мед натуральный|мёд натуральный|мед цветоч|мёд цветоч|мед суфле|мёд суфле|мед-суфле|мёд-суфле|крем мед|крем мёд|крем-мед|крем-мёд|медовый десерт|орехи в меду|орехи в мёду';
  v_nuts text :=
    'миндал|фундук|лесной орех|грецк|гретск|кешью|кедров|арахис|фисташ|пекан|орехи в скорлупе|орехи россыпью|смесь орехов|ассорти орехов|набор орехов';
  v_fruit text :=
    'яблок|груш|виноград|инжир|апельсин|мандарин|манго|ананас|персик|абрикос|клубник|малина|ежевик';
  v_dried_fruit text := 'сухофрукт|финик|курага|чернослив|изюм';
  v_cheese text :=
    'камамбер|camembert|сыр бри|сыр brie|горгонзол|gorgonzol|рокфор|rockforo|roquefort|дорблю|dorblu|blue cheese|маасдам|масдам|чеддер|чеддар|cheddar|пармезан|parmigiano|гауда|gouda|грюйер|gruy|сыр качотта|сыр с голубой плесенью';
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
chay-v-podarochnoy-korzine-kak-vybrat-udachnyy-sostav
podarochnye-korziny-s-chaem
chay-v-podarok-kak-vybrat
kak-sobrat-podarochnuyu-korzinu-s-chaem
chto-podarit-lyubitelyu-chaya
chernyy-chay-v-podarochnoy-korzine
zelenyy-chay-v-podarochnoy-korzine
belyy-chay-v-podarochnoy-korzine
zhasminovyy-chay-v-podarochnoy-korzine
travyanoy-chay-v-podarochnoy-korzine
krupnolistovoy-chay-v-podarok
pressovannyy-chay-v-podarok
chay-v-paketikah-v-podarochnom-nabore
taezhnyy-chay-v-podarochnoy-korzine
chay-s-pryanostyami-v-podarke
chay-s-yagodami-v-podarochnoy-korzine
chay-s-zemlyanikoy-v-podarok
chay-s-karamelyu-v-podarok
chay-s-persikom-i-abrikosom-v-podarok
chay-s-zhenshenem-v-podarochnoy-korzine
chay-s-sagaan-dali-v-podarok
earl-grey-v-podarochnoy-korzine
chay-basilur-v-podarochnyh-korzinah
basilur-earl-grey-v-podarok
basilur-karamel-v-podarok
belyy-chay-basilur-v-podarok
zhasminovyy-chay-basilur-v-podarok
basilur-chaynaya-kniga-v-podarok
basilur-v-paketikah-v-podarochnoy-korzine
chay-chabo-v-podarochnyh-korzinah
chabo-energiya-taygi-v-podarok
chabo-moroznaya-zemlyanika-v-podarok
chabo-zimniy-v-podarochnoy-korzine
chay-dilmah-v-podarochnyh-korzinah
dilmah-paradise-v-podarok
dilmah-paradise-persik-i-abrikos-v-podarok
chay-hampstead-assorti-v-podarok
riston-magic-of-winter-v-podarok
chelton-zolotoe-schaste-v-podarok
chay-hilltop-v-muzykalnoy-shkatulke
chay-nadin-v-podarochnoy-korzine
travyanoy-chay-zolotoy-medved-v-podarok
travyanoy-chay-lesnaya-tish-v-podarok
zhasminovyy-chay-v-steklyannoy-banke
chay-v-muzykalnoy-shkatulke-v-podarok
chay-v-zhestyanoy-banke-v-podarok
chay-v-steklyannoy-banke-v-podarok
chaynoe-assorti-v-podarochnoy-korzine
chay-i-med-luchshie-podarochnye-sochetaniya
chay-i-shokolad-v-podarochnoy-korzine
chay-i-orehi-v-podarok
chay-i-suhofrukty-v-podarochnoy-korzine
chay-i-pechene-v-podarok
chay-i-konfety-v-podarochnoy-korzine
chay-i-varene-v-podarok
chay-i-frukty-v-podarochnoy-korzine
chay-i-syr-v-podarochnoy-korzine
chay-i-martsipan-v-podarok
chay-i-karamel-v-podarochnoy-korzine
chay-i-yagody-v-podarok
chay-i-zemlyanika-v-podarochnoy-korzine
chay-i-pryanosti-v-podarke
chto-polozhit-v-podarochnyy-nabor-s-chaem
kak-vybrat-chernyy-chay-v-podarok
kak-vybrat-zelenyy-chay-v-podarok
kak-vybrat-belyy-chay-v-podarok
kak-vybrat-zhasminovyy-chay-v-podarok
kak-vybrat-travyanoy-chay-v-podarok
kak-vybrat-earl-grey-v-podarok
kak-hranit-chay-doma
srok-hraneniya-chaya
pochemu-chay-teryaet-aromat
kak-ponyat-chto-chay-svezhiy
kak-hranit-chay-v-zhestyanoy-banke
kak-hranit-chay-v-steklyannoy-banke
malenkiy-podarochnyy-boks-s-chaem
bolshaya-podarochnaya-korzina-s-chaem
premialnaya-korzina-s-chaem
chay-v-podarok-muzhchine
chay-v-podarok-zhenschine
chay-v-podarok-rukovoditelyu
chay-v-podarok-direktoru
chay-v-podarok-nachalniku
chay-v-podarok-kollege
chay-v-podarok-sotrudnikam
korporativnye-podarki-s-chaem
chay-v-podarok-partneram
chay-v-podarok-klientam
chay-na-den-rozhdeniya-v-podarok
chay-na-novyy-god-v-podarok
novogodnyaya-korzina-s-chaem
chay-v-podarok-na-23-fevralya
chay-v-podarok-na-8-marta
chay-v-podarok-uchitelyu
chay-v-podarok-vrachu
chay-v-podarok-seme
originalnyy-podarok-s-chaem
vkusnyy-podarok-s-chaem
nabor-chay-i-med-v-podarok
nabor-chay-i-shokolad-v-podarok
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
          'chernyy-chay-v-podarochnoy-korzine',
          'kak-vybrat-chernyy-chay-v-podarok'
        ) then 'черный чай|чёрный чай|чай черный|чай чёрный|зимний черный чай'
        when s.alias in (
          'zelenyy-chay-v-podarochnoy-korzine',
          'kak-vybrat-zelenyy-chay-v-podarok'
        ) then 'зеленый чай|зелёный чай|чай зеленый|чай зелёный'
        when s.alias in (
          'belyy-chay-v-podarochnoy-korzine',
          'kak-vybrat-belyy-chay-v-podarok'
        ) then 'белый чай'
        when s.alias in (
          'zhasminovyy-chay-v-podarochnoy-korzine',
          'kak-vybrat-zhasminovyy-chay-v-podarok'
        ) then 'жасминовый чай'
        when s.alias in (
          'travyanoy-chay-v-podarochnoy-korzine',
          'kak-vybrat-travyanoy-chay-v-podarok'
        ) then 'травяной чай|чай травяной'
        when s.alias = 'krupnolistovoy-chay-v-podarok' then 'крупнолистовой'
        when s.alias = 'pressovannyy-chay-v-podarok' then 'прессованный'
        when s.alias in (
          'chay-v-paketikah-v-podarochnom-nabore',
          'basilur-v-paketikah-v-podarochnoy-korzine'
        ) then '20*1,5|20х2.06|25x1,5|пакетик'
        when s.alias = 'taezhnyy-chay-v-podarochnoy-korzine' then
          'энергия тайги|таежный|таёжный|золотой медведь|лесная тишь|сагааг-дайля'
        when s.alias in (
          'chay-s-pryanostyami-v-podarke',
          'chay-i-pryanosti-v-podarke'
        ) then 'чай с пряностями|чай с травами|зимний черный чай|зимний чёрный чай'
        when s.alias in (
          'chay-s-yagodami-v-podarochnoy-korzine',
          'chay-s-zemlyanikoy-v-podarok',
          'chay-i-zemlyanika-v-podarochnoy-korzine'
        ) then 'морозная земляника'
        when s.alias = 'chay-s-karamelyu-v-podarok' then
          'чай basilur карамель|basilur карамель'
        when s.alias = 'chay-s-persikom-i-abrikosom-v-podarok' then
          'dilmah paradise персик и абрикос'
        when s.alias = 'chay-s-zhenshenem-v-podarochnoy-korzine' then
          'чай травяной жень-шень|травяной жень-шень'
        when s.alias = 'chay-s-sagaan-dali-v-podarok' then
          'сагааг-дайля|сагаан-дали'
        when s.alias in (
          'earl-grey-v-podarochnoy-korzine',
          'basilur-earl-grey-v-podarok',
          'kak-vybrat-earl-grey-v-podarok'
        ) then 'earl grey|efrl grey'
        when s.alias = 'chay-basilur-v-podarochnyh-korzinah' then
          'чай basilur|чай базилур|чай базелюр'
        when s.alias = 'basilur-karamel-v-podarok' then
          'чай basilur карамель|basilur карамель'
        when s.alias = 'belyy-chay-basilur-v-podarok' then
          'белый чай базелюр|белый чай basilur'
        when s.alias = 'zhasminovyy-chay-basilur-v-podarok' then
          'жасминовый чай базелюр|жасминовый чай basilur'
        when s.alias = 'basilur-chaynaya-kniga-v-podarok' then
          'basilur чайная книга|чайная книга'
        when s.alias = 'chay-chabo-v-podarochnyh-korzinah' then 'чай chabo'
        when s.alias = 'chabo-energiya-taygi-v-podarok' then 'энергия тайги'
        when s.alias = 'chabo-moroznaya-zemlyanika-v-podarok' then
          'морозная земляника'
        when s.alias = 'chabo-zimniy-v-podarochnoy-korzine' then
          'chabo зимний|зимний черный чай с пряностями chabo|черный чай с пряностями зимний'
        when s.alias = 'chay-dilmah-v-podarochnyh-korzinah' then 'чай dilmah'
        when s.alias = 'dilmah-paradise-v-podarok' then 'dilmah paradise'
        when s.alias = 'dilmah-paradise-persik-i-abrikos-v-podarok' then
          'dilmah paradise персик и абрикос'
        when s.alias = 'chay-hampstead-assorti-v-podarok' then
          'чай черный ассорти hampstead|hampstead'
        when s.alias = 'riston-magic-of-winter-v-podarok' then
          'riston magic of winter'
        when s.alias = 'chelton-zolotoe-schaste-v-podarok' then
          'золотое счастье'
        when s.alias in (
          'chay-hilltop-v-muzykalnoy-shkatulke',
          'chay-v-muzykalnoy-shkatulke-v-podarok'
        ) then 'чай hilltop музыкальная шкатулка|музыкальная шкатулка'
        when s.alias = 'chay-nadin-v-podarochnoy-korzine' then 'чай nadin'
        when s.alias = 'travyanoy-chay-zolotoy-medved-v-podarok' then
          'золотой медведь'
        when s.alias = 'travyanoy-chay-lesnaya-tish-v-podarok' then
          'лесная тишь'
        when s.alias in (
          'zhasminovyy-chay-v-steklyannoy-banke',
          'chay-v-steklyannoy-banke-v-podarok',
          'kak-hranit-chay-v-steklyannoy-banke'
        ) then v_tea
        when s.alias in (
          'chay-v-zhestyanoy-banke-v-podarok',
          'kak-hranit-chay-v-zhestyanoy-banke'
        ) then 'чай в баночке chabo|чай chabo в баночке|чайная книга'
        when s.alias = 'chaynoe-assorti-v-podarochnoy-korzine' then
          'ассорти черного чая|ассорти чёрного чая|чай черный ассорти|чай чёрный ассорти|чайная книга'
        else v_tea
      end as tea_filter,
      case
        when s.alias in (
          'chay-i-med-luchshie-podarochnye-sochetaniya',
          'nabor-chay-i-med-v-podarok'
        ) then v_honey
        when s.alias in (
          'chay-i-shokolad-v-podarochnoy-korzine',
          'nabor-chay-i-shokolad-v-podarok'
        ) then 'шоколад'
        when s.alias = 'chay-i-orehi-v-podarok' then v_nuts
        when s.alias = 'chay-i-suhofrukty-v-podarochnoy-korzine' then
          v_dried_fruit
        when s.alias = 'chay-i-pechene-v-podarok' then 'печенье|бискотти|кантуччи'
        when s.alias = 'chay-i-konfety-v-podarochnoy-korzine' then 'конфет'
        when s.alias = 'chay-i-varene-v-podarok' then 'варенье|джем'
        when s.alias = 'chay-i-frukty-v-podarochnoy-korzine' then v_fruit
        when s.alias = 'chay-i-syr-v-podarochnoy-korzine' then v_cheese
        when s.alias = 'chay-i-martsipan-v-podarok' then 'марципан'
        when s.alias = 'chay-i-karamel-v-podarochnoy-korzine' then 'карамел'
        when s.alias = 'chay-i-yagody-v-podarok' then
          'клубник|малина|ежевик|брусник|клюкв|земляник'
        when s.alias in (
          'premialnaya-korzina-s-chaem',
          'chay-v-podarok-rukovoditelyu',
          'chay-v-podarok-direktoru',
          'chay-v-podarok-nachalniku'
        ) then v_premium
        when s.alias in (
          'chay-v-podarok-muzhchine',
          'chay-v-podarok-na-23-fevralya'
        ) then v_meat || '|' || v_cheese || '|' || v_nuts
        when s.alias in (
          'chay-v-podarok-zhenschine',
          'chay-v-podarok-na-8-marta'
        ) then 'шоколад|конфет|печенье|' || v_fruit || '|' || v_honey || '|варенье|джем'
        when s.alias = 'chay-v-podarok-kollege' then
          'шоколад|конфет|печенье|кофе|' || v_nuts
        when s.alias in (
          'chay-v-podarok-sotrudnikam',
          'korporativnye-podarki-s-chaem'
        ) then 'шоколад|конфет|печенье|кофе'
        when s.alias in (
          'chay-v-podarok-partneram',
          'chay-v-podarok-klientam'
        ) then v_premium || '|' || v_cheese || '|' || v_meat
        when s.alias = 'malenkiy-podarochnyy-boks-s-chaem' then
          'шоколад|конфет|печенье'
        when s.alias = 'bolshaya-podarochnaya-korzina-s-chaem' then
          v_fruit || '|' || v_cheese || '|' || v_meat || '|' || v_nuts
        else null
      end as secondary_filter,
      case
        when s.alias in (
          'chay-v-podarok-muzhchine',
          'chay-v-podarok-na-23-fevralya'
        ) then 'tea-men'
        when s.alias in (
          'chay-v-podarok-zhenschine',
          'chay-v-podarok-na-8-marta'
        ) then 'tea-women'
        when s.alias in (
          'premialnaya-korzina-s-chaem',
          'chay-v-podarok-rukovoditelyu',
          'chay-v-podarok-direktoru',
          'chay-v-podarok-nachalniku'
        ) then 'tea-executive'
        when s.alias = 'chay-v-podarok-kollege' then 'tea-colleague'
        when s.alias in (
          'chay-v-podarok-sotrudnikam',
          'korporativnye-podarki-s-chaem'
        ) then 'tea-employees'
        when s.alias in (
          'chay-v-podarok-partneram',
          'chay-v-podarok-klientam'
        ) then 'tea-partners'
        when s.alias ~ '(^|-)i-|nabor-chay-i-' then 'tea-pairings'
        when s.alias ~
          'chernyy|zelenyy|belyy|zhasminovyy|travyanoy|krupnolistovoy|pressovannyy|paketikah|taezhnyy' then
          'tea-types'
        when s.alias ~
          'basilur|chabo|dilmah|hampstead|riston|chelton|hilltop|nadin|earl-grey|zolotoy-medved|lesnaya-tish' then
          'tea-brands'
        when s.alias ~
          'pryanost|yagod|zemlyanik|karamel|persik|abrikos|zhenshen|sagaan' then
          'tea-flavours'
        when s.alias ~
          'paketikah|shkatulke|banke|assorti' then 'tea-formats'
        when s.alias ~
          'kak-hranit|srok-hraneniya|teryaet-aromat|svezhiy|kak-vybrat' then
          'tea-guides'
        when s.alias ~
          'den-rozhdeniya|novyy-god|novogod|23-fevralya|8-marta|uchitelyu|vrachu|seme' then
          'tea-occasions'
        else 'tea-gifts'
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
        when c.secondary_filter is null then c.tea_filter
        else c.tea_filter || '&&' || c.secondary_filter
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
      when 'tea-pairings' then
        'Корзины SweetGift с чаем и выбранным сочетанием'
      when 'tea-types' then 'Корзины SweetGift с выбранным видом чая'
      when 'tea-brands' then 'Корзины SweetGift с выбранной маркой чая'
      when 'tea-flavours' then 'Корзины SweetGift с выбранным вкусом чая'
      when 'tea-formats' then 'Корзины SweetGift с чаем в выбранном формате'
      when 'tea-guides' then 'Доступные подарочные корзины SweetGift с чаем'
      when 'tea-men' then
        'Гастрономические подарочные корзины SweetGift с чаем для мужчин'
      when 'tea-women' then
        'Сладкие и фруктовые подарочные корзины SweetGift с чаем'
      when 'tea-executive' then
        'Премиальные и статусные подарочные корзины SweetGift с чаем'
      when 'tea-colleague' then
        'Универсальные подарочные корзины SweetGift с чаем для коллег'
      when 'tea-employees' then
        'Корпоративные подарочные корзины SweetGift с чаем'
      when 'tea-partners' then
        'Премиальные деловые подарочные корзины SweetGift с чаем'
      when 'tea-occasions' then
        'Подарочные корзины SweetGift с чаем к празднику'
      else 'Популярные подарочные корзины SweetGift с чаем'
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

revoke all on function public.sync_tea_article_filters(jsonb) from public;
grant execute on function public.sync_tea_article_filters(jsonb)
  to service_role;

-- Seed filters for the articles that were imported before this migration.
select public.sync_tea_article_filters(
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

comment on function public.sync_tea_article_filters(jsonb) is
  'Upserts the 100 published Tea article filters using observed catalog traits.';
