-- Configure the published Fruit SEO cluster through the existing
-- article_product_filters -> article_product_cache -> get_article_products()
-- pipeline. Only fruit wording observed in the catalog is used. Pairings use
-- mandatory groups separated by &&.

create or replace function public.sync_fruit_article_filters(p_articles jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fruit text :=
    'абрикос|авокадо|ананас|апельсин|арбуз|банан|виноград|гранадила|гранат|грейпфрут|груша|гуава|джекфрут|инжир|карамбола|киви|кокос|кумкват|лайм|лимон|личи|лонган|манго|мангостин|мандарин|маракуйя|нектарин|папайя|персик|питахайя|рамбутан|слива|фейхоа|физалис|хурма|черешня|яблок|клубник|малина|ежевик|голубик|красная смородина';
  v_exotic text :=
    'ананас|авокадо|гранадила|гуава|джекфрут|карамбола|киви|кокос|кумкват|лайм|личи|лонган|манго|мангостин|маракуйя|папайя|питахайя|рамбутан|фейхоа|физалис';
  v_citrus text := 'апельсин|грейпфрут|кумкват|лайм|лимон|мандарин';
  v_berries text :=
    'клубник|малина|ежевик|голубик|красная смородина|черешня';
  v_cheese text :=
    'камамбер|camembert|сыр бри|сыр brie|горгонзол|gorgonzol|рокфор|roquefort|rockforo|дорблю|dorblu|маасдам|чеддер|пармезан|гауда';
  v_nuts text :=
    'миндал|фундук|лесной орех|грецк|кешью|кедров|арахис|фисташ|пекан|смесь орехов|ассорти орехов';
  v_honey text :=
    'мед натуральный|мёд натуральный|мед цветоч|мёд цветоч|мед-суфле|мёд-суфле|крем-мед|крем-мёд|медовый десерт';
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
abrikos-v-podarochnoy-korzine
avokado-v-podarochnoy-korzine
ananas-v-podarochnoy-korzine
apelsin-v-podarochnoy-korzine
arbuz-v-podarochnoy-korzine
banan-v-podarochnoy-korzine
vinograd-v-podarochnoy-korzine
granadilla-v-podarochnoy-korzine
granat-v-podarochnoy-korzine
greypfrut-v-podarochnoy-korzine
grusha-v-podarochnoy-korzine
guava-v-podarochnoy-korzine
dzhekfrut-v-podarochnoy-korzine
inzhir-v-podarochnoy-korzine
karambola-v-podarochnoy-korzine
kivi-v-podarochnoy-korzine
kokos-v-podarochnoy-korzine
kumkvat-v-podarochnoy-korzine
laym-v-podarochnoy-korzine
limon-v-podarochnoy-korzine
lichi-v-podarochnoy-korzine
longan-v-podarochnoy-korzine
mango-v-podarochnoy-korzine
mangostin-v-podarochnoy-korzine
mandarin-v-podarochnoy-korzine
marakuyya-v-podarochnoy-korzine
nektarin-v-podarochnoy-korzine
papayya-v-podarochnoy-korzine
persik-v-podarochnoy-korzine
pitahayya-v-podarochnoy-korzine
rambutan-v-podarochnoy-korzine
sliva-v-podarochnoy-korzine
feyhoa-v-podarochnoy-korzine
fizalis-v-podarochnoy-korzine
hurma-v-podarochnoy-korzine
chereshnya-v-podarochnoy-korzine
yabloko-v-podarochnoy-korzine
klubnika-v-podarochnoy-korzine
malina-v-podarochnoy-korzine
ezhevika-v-podarochnoy-korzine
golubika-v-podarochnoy-korzine
krasnaya-smorodina-v-podarochnoy-korzine
medovyy-ananas-v-podarochnoy-korzine
ananas-gold-v-podarochnoy-korzine
mini-ananas-v-podarochnoy-korzine
zelenyy-vinograd-v-podarochnoy-korzine
temnyy-vinograd-v-podarochnoy-korzine
belyy-vinograd-v-podarochnoy-korzine
chernyy-vinograd-v-podarochnoy-korzine
vinograd-shayn-muskat-v-podarochnoy-korzine
krasnye-yabloki-v-podarochnoy-korzine
zelenye-yabloki-v-podarochnoy-korzine
grusha-konferents-v-podarochnoy-korzine
mini-banany-v-podarochnoy-korzine
mango-keo-v-podarochnoy-korzine
mango-iz-brazilii-v-podarochnoy-korzine
zheltoe-mango-v-podarochnoy-korzine
mini-mango-v-podarochnoy-korzine
kivi-gold-v-podarochnoy-korzine
zheltaya-pitahayya-v-podarochnoy-korzine
krasnaya-pitahayya-v-podarochnoy-korzine
mini-arbuz-v-podarochnoy-korzine
frukty-v-podarochnoy-korzine-kak-vybrat-sostav
fruktovaya-korzina-v-podarok
kakie-frukty-vybrat-dlya-podarochnoy-korziny
ekzoticheskie-frukty-v-podarochnoy-korzine
sezonnye-frukty-v-podarochnoy-korzine
fruktovaya-korzina-dlya-muzhchiny
fruktovaya-korzina-dlya-zhenschiny
fruktovaya-korzina-dlya-rukovoditelya
fruktovaya-korzina-dlya-semi
ananas-i-vinograd-v-podarochnoy-korzine
mango-i-marakuyya-v-podarochnoy-korzine
pitahayya-i-papayya-v-podarochnoy-korzine
yabloki-i-grushi-v-podarochnoy-korzine
tsitrusovye-v-podarochnoy-korzine
tropicheskie-frukty-v-podarochnoy-korzine
frukty-i-yagody-v-odnoy-korzine
frukty-i-syr-v-podarochnoy-korzine
frukty-i-orehi-v-podarochnoy-korzine
frukty-i-med-v-podarochnoy-korzine
frukty-i-shokolad-v-podarochnoy-korzine
fruktovaya-korzina-na-den-rozhdeniya
fruktovaya-korzina-na-yubiley
fruktovaya-korzina-kollege
fruktovaya-korzina-partneram
korporativnye-fruktovye-korziny
premialnaya-fruktovaya-korzina
bolshaya-fruktovaya-korzina-v-podarok
nebolshaya-fruktovaya-korzina-v-podarok
fruktovaya-korzina-bez-sladostey
fruktovaya-korzina-s-ekzoticheskimi-fruktami
kak-vybrat-svezhie-frukty-dlya-podarka
kak-hranit-fruktovuyu-korzinu-posle-dostavki
kak-podobrat-frukty-po-sezonu
kak-oformit-fruktovuyu-korzinu-v-podarok
pochemu-fruktovaya-korzina-podhodit-dlya-delovogo-podarka
frukty-i-chay-v-podarochnoy-korzine
frukty-i-kofe-v-podarochnoy-korzine
frukty-i-suhofrukty-v-podarochnoy-korzine
$aliases$), '\s+')
    )
      and trim(x.url) ~
        '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$'
  ),
  classified as (
    select
      s.*,
      case
        when s.alias = 'abrikos-v-podarochnoy-korzine' then 'абрикос'
        when s.alias = 'avokado-v-podarochnoy-korzine' then 'авокадо'
        when s.alias ~ '(^|-)ananas-' and s.alias !~ 'i-vinograd' then
          case
            when s.alias ~ 'medovyy-ananas' then 'медовый ананас'
            when s.alias ~ 'ananas-gold' then 'ананас gold|ананас голд'
            when s.alias ~ 'mini-ananas' then 'мини ананас|мини-ананас'
            else 'ананас'
          end
        when s.alias = 'apelsin-v-podarochnoy-korzine' then 'апельсин'
        when s.alias = 'arbuz-v-podarochnoy-korzine' then 'арбуз'
        when s.alias = 'mini-arbuz-v-podarochnoy-korzine' then 'мини арбуз|мини-арбуз'
        when s.alias = 'banan-v-podarochnoy-korzine' then 'банан'
        when s.alias = 'mini-banany-v-podarochnoy-korzine' then 'мини банан|мини-банан'
        when s.alias = 'vinograd-v-podarochnoy-korzine' then 'виноград'
        when s.alias = 'zelenyy-vinograd-v-podarochnoy-korzine' then 'виноград зелен|зелёный виноград|зеленый виноград'
        when s.alias = 'temnyy-vinograd-v-podarochnoy-korzine' then 'виноград темн|тёмный виноград|темный виноград'
        when s.alias = 'belyy-vinograd-v-podarochnoy-korzine' then 'виноград бел|белый виноград'
        when s.alias = 'chernyy-vinograd-v-podarochnoy-korzine' then 'виноград черн|чёрный виноград|черный виноград'
        when s.alias = 'vinograd-shayn-muskat-v-podarochnoy-korzine' then 'шайн мускат|shine muscat'
        when s.alias = 'granadilla-v-podarochnoy-korzine' then 'гранадила'
        when s.alias = 'granat-v-podarochnoy-korzine' then 'гранат'
        when s.alias = 'greypfrut-v-podarochnoy-korzine' then 'грейпфрут'
        when s.alias = 'grusha-v-podarochnoy-korzine' then 'груша'
        when s.alias = 'grusha-konferents-v-podarochnoy-korzine' then 'груша конференц|конференц'
        when s.alias = 'guava-v-podarochnoy-korzine' then 'гуава'
        when s.alias = 'dzhekfrut-v-podarochnoy-korzine' then 'джекфрут'
        when s.alias = 'inzhir-v-podarochnoy-korzine' then 'инжир'
        when s.alias = 'karambola-v-podarochnoy-korzine' then 'карамбола'
        when s.alias = 'kivi-v-podarochnoy-korzine' then 'киви'
        when s.alias = 'kivi-gold-v-podarochnoy-korzine' then 'киви gold|киви голд'
        when s.alias = 'kokos-v-podarochnoy-korzine' then 'кокос'
        when s.alias = 'kumkvat-v-podarochnoy-korzine' then 'кумкват'
        when s.alias = 'laym-v-podarochnoy-korzine' then 'лайм'
        when s.alias = 'limon-v-podarochnoy-korzine' then 'лимон'
        when s.alias = 'lichi-v-podarochnoy-korzine' then 'личи'
        when s.alias = 'longan-v-podarochnoy-korzine' then 'лонган'
        when s.alias = 'mango-v-podarochnoy-korzine' then 'манго'
        when s.alias = 'mango-keo-v-podarochnoy-korzine' then 'манго keo|манго кео'
        when s.alias = 'mango-iz-brazilii-v-podarochnoy-korzine' then 'манго бразил|бразильское манго'
        when s.alias = 'zheltoe-mango-v-podarochnoy-korzine' then 'манго желт|манго жёлт|желтое манго|жёлтое манго'
        when s.alias = 'mini-mango-v-podarochnoy-korzine' then 'мини манго|мини-манго'
        when s.alias = 'mangostin-v-podarochnoy-korzine' then 'мангостин'
        when s.alias = 'mandarin-v-podarochnoy-korzine' then 'мандарин'
        when s.alias = 'marakuyya-v-podarochnoy-korzine' then 'маракуйя'
        when s.alias = 'nektarin-v-podarochnoy-korzine' then 'нектарин'
        when s.alias = 'papayya-v-podarochnoy-korzine' then 'папайя'
        when s.alias = 'persik-v-podarochnoy-korzine' then 'персик'
        when s.alias = 'pitahayya-v-podarochnoy-korzine' then 'питахайя'
        when s.alias = 'zheltaya-pitahayya-v-podarochnoy-korzine' then 'питахайя желт|питахайя жёлт|желтая питахайя|жёлтая питахайя'
        when s.alias = 'krasnaya-pitahayya-v-podarochnoy-korzine' then 'питахайя красн|красная питахайя'
        when s.alias = 'rambutan-v-podarochnoy-korzine' then 'рамбутан'
        when s.alias = 'sliva-v-podarochnoy-korzine' then 'слива'
        when s.alias = 'feyhoa-v-podarochnoy-korzine' then 'фейхоа'
        when s.alias = 'fizalis-v-podarochnoy-korzine' then 'физалис'
        when s.alias = 'hurma-v-podarochnoy-korzine' then 'хурма'
        when s.alias = 'chereshnya-v-podarochnoy-korzine' then 'черешня'
        when s.alias = 'yabloko-v-podarochnoy-korzine' then 'яблок'
        when s.alias = 'krasnye-yabloki-v-podarochnoy-korzine' then 'яблок красн|красные яблоки|красное яблоко'
        when s.alias = 'zelenye-yabloki-v-podarochnoy-korzine' then 'яблок зелен|яблок зелён|зеленые яблоки|зелёные яблоки'
        when s.alias = 'klubnika-v-podarochnoy-korzine' then 'клубник'
        when s.alias = 'malina-v-podarochnoy-korzine' then 'малина'
        when s.alias = 'ezhevika-v-podarochnoy-korzine' then 'ежевик'
        when s.alias = 'golubika-v-podarochnoy-korzine' then 'голубик'
        when s.alias = 'krasnaya-smorodina-v-podarochnoy-korzine' then 'красная смородина'
        when s.alias ~ 'ekzotichesk|tropichesk' then v_exotic
        when s.alias = 'tsitrusovye-v-podarochnoy-korzine' then v_citrus
        else v_fruit
      end as fruit_filter,
      case
        when s.alias = 'ananas-i-vinograd-v-podarochnoy-korzine' then 'виноград'
        when s.alias = 'mango-i-marakuyya-v-podarochnoy-korzine' then 'маракуйя'
        when s.alias = 'pitahayya-i-papayya-v-podarochnoy-korzine' then 'папайя'
        when s.alias = 'yabloki-i-grushi-v-podarochnoy-korzine' then 'груша'
        when s.alias = 'frukty-i-yagody-v-odnoy-korzine' then v_berries
        when s.alias = 'frukty-i-syr-v-podarochnoy-korzine' then v_cheese
        when s.alias = 'frukty-i-orehi-v-podarochnoy-korzine' then v_nuts
        when s.alias = 'frukty-i-med-v-podarochnoy-korzine' then v_honey
        when s.alias = 'frukty-i-shokolad-v-podarochnoy-korzine' then 'шоколад'
        when s.alias = 'frukty-i-chay-v-podarochnoy-korzine' then 'чай'
        when s.alias = 'frukty-i-kofe-v-podarochnoy-korzine' then 'кофе'
        when s.alias = 'frukty-i-suhofrukty-v-podarochnoy-korzine' then 'сухофрукт|финик|курага|чернослив|изюм'
        when s.alias ~ 'rukovoditelya|partneram|korporativ|premialnaya|delovogo' then
          'сыр|шоколад|кофе|чай|икра|краб|орех'
        when s.alias ~ 'dlya-muzhchiny' then 'сыр|орех|кофе|мяс|колбас|паштет'
        when s.alias ~ 'dlya-zhenschiny' then 'ягод|шоколад|конфет|сыр'
        when s.alias = 'fruktovaya-korzina-bez-sladostey' then null
        else null
      end as secondary_filter,
      case
        when s.alias ~ '(^|-)i-(vinograd|marakuyya|papayya|grushi|yagody|syr|orehi|med|shokolad|chay|kofe|suhofrukty)(-|$)' then 'fruit-pairings'
        when s.alias ~ 'medovyy|gold|mini|zelenyy-vinograd|temnyy-vinograd|belyy-vinograd|chernyy-vinograd|shayn-muskat|krasnye-yabloki|zelenye-yabloki|konferents|keo|brazilii|zheltoe-mango|kivi-gold|zheltaya-pitahayya|krasnaya-pitahayya' then 'fruit-varieties'
        when s.alias ~ 'dlya-|na-den|na-yubiley|kollege|partneram|korporativ|premialnaya|bolshaya|nebolshaya|bez-sladostey|delovogo' then 'fruit-gifts'
        when s.alias ~ 'kak-|pochemu-' then 'fruit-guides'
        else 'fruit-types'
      end as cluster_key
    from source s
  ),
  prepared as (
    select
      c.alias,
      coalesce(c.title, 'Фрукты в подарочных корзинах SweetGift') as title,
      c.article_url,
      case
        when c.secondary_filter is null then 'ingredient_contains'
        else 'ingredient_all_contains'
      end as filter_type,
      case
        when c.alias = 'ananas-i-vinograd-v-podarochnoy-korzine' then 'ананас&&' || c.secondary_filter
        when c.alias = 'mango-i-marakuyya-v-podarochnoy-korzine' then 'манго&&' || c.secondary_filter
        when c.alias = 'pitahayya-i-papayya-v-podarochnoy-korzine' then 'питахайя&&' || c.secondary_filter
        when c.alias = 'yabloki-i-grushi-v-podarochnoy-korzine' then 'яблок&&' || c.secondary_filter
        when c.secondary_filter is null then c.fruit_filter
        else c.fruit_filter || '&&' || c.secondary_filter
      end as filter_value,
      c.cluster_key
    from classified c
  ),
  ordered as (
    select p.*,
      row_number() over (partition by p.cluster_key order by p.alias)::integer
        as cluster_order
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
      when 'fruit-pairings' then 'Подарочные корзины SweetGift с выбранным сочетанием фруктов'
      when 'fruit-varieties' then 'Корзины SweetGift с выбранным сортом или видом фруктов'
      when 'fruit-gifts' then 'Фруктовые подарочные корзины SweetGift'
      when 'fruit-guides' then 'Популярные фруктовые корзины SweetGift'
      else 'Корзины SweetGift с выбранными фруктами'
    end,
    12,
    true,
    p.cluster_key,
    p.cluster_order,
    p.article_url
  from ordered p
  on conflict (alias) do update
  set filter_type = excluded.filter_type,
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

revoke all on function public.sync_fruit_article_filters(jsonb) from public;
grant execute on function public.sync_fruit_article_filters(jsonb) to service_role;

select public.sync_fruit_article_filters(
  coalesce(
    jsonb_agg(jsonb_build_object(
      'alias', regexp_replace(a.url, '^.*/', ''),
      'title', a.title,
      'url', a.url
    )),
    '[]'::jsonb
  )
)
from public.articles_index a
where a.is_active = true
  and regexp_replace(a.url, '^.*/', '') = any (
    regexp_split_to_array(trim($aliases$
abrikos-v-podarochnoy-korzine avokado-v-podarochnoy-korzine ananas-v-podarochnoy-korzine apelsin-v-podarochnoy-korzine arbuz-v-podarochnoy-korzine banan-v-podarochnoy-korzine vinograd-v-podarochnoy-korzine granadilla-v-podarochnoy-korzine granat-v-podarochnoy-korzine greypfrut-v-podarochnoy-korzine grusha-v-podarochnoy-korzine guava-v-podarochnoy-korzine dzhekfrut-v-podarochnoy-korzine inzhir-v-podarochnoy-korzine karambola-v-podarochnoy-korzine kivi-v-podarochnoy-korzine kokos-v-podarochnoy-korzine kumkvat-v-podarochnoy-korzine laym-v-podarochnoy-korzine limon-v-podarochnoy-korzine lichi-v-podarochnoy-korzine longan-v-podarochnoy-korzine mango-v-podarochnoy-korzine mangostin-v-podarochnoy-korzine mandarin-v-podarochnoy-korzine marakuyya-v-podarochnoy-korzine nektarin-v-podarochnoy-korzine papayya-v-podarochnoy-korzine persik-v-podarochnoy-korzine pitahayya-v-podarochnoy-korzine rambutan-v-podarochnoy-korzine sliva-v-podarochnoy-korzine feyhoa-v-podarochnoy-korzine fizalis-v-podarochnoy-korzine hurma-v-podarochnoy-korzine chereshnya-v-podarochnoy-korzine yabloko-v-podarochnoy-korzine klubnika-v-podarochnoy-korzine malina-v-podarochnoy-korzine ezhevika-v-podarochnoy-korzine golubika-v-podarochnoy-korzine krasnaya-smorodina-v-podarochnoy-korzine medovyy-ananas-v-podarochnoy-korzine ananas-gold-v-podarochnoy-korzine mini-ananas-v-podarochnoy-korzine zelenyy-vinograd-v-podarochnoy-korzine temnyy-vinograd-v-podarochnoy-korzine belyy-vinograd-v-podarochnoy-korzine chernyy-vinograd-v-podarochnoy-korzine vinograd-shayn-muskat-v-podarochnoy-korzine krasnye-yabloki-v-podarochnoy-korzine zelenye-yabloki-v-podarochnoy-korzine grusha-konferents-v-podarochnoy-korzine mini-banany-v-podarochnoy-korzine mango-keo-v-podarochnoy-korzine mango-iz-brazilii-v-podarochnoy-korzine zheltoe-mango-v-podarochnoy-korzine mini-mango-v-podarochnoy-korzine kivi-gold-v-podarochnoy-korzine zheltaya-pitahayya-v-podarochnoy-korzine krasnaya-pitahayya-v-podarochnoy-korzine mini-arbuz-v-podarochnoy-korzine frukty-v-podarochnoy-korzine-kak-vybrat-sostav fruktovaya-korzina-v-podarok kakie-frukty-vybrat-dlya-podarochnoy-korziny ekzoticheskie-frukty-v-podarochnoy-korzine sezonnye-frukty-v-podarochnoy-korzine fruktovaya-korzina-dlya-muzhchiny fruktovaya-korzina-dlya-zhenschiny fruktovaya-korzina-dlya-rukovoditelya fruktovaya-korzina-dlya-semi ananas-i-vinograd-v-podarochnoy-korzine mango-i-marakuyya-v-podarochnoy-korzine pitahayya-i-papayya-v-podarochnoy-korzine yabloki-i-grushi-v-podarochnoy-korzine tsitrusovye-v-podarochnoy-korzine tropicheskie-frukty-v-podarochnoy-korzine frukty-i-yagody-v-odnoy-korzine frukty-i-syr-v-podarochnoy-korzine frukty-i-orehi-v-podarochnoy-korzine frukty-i-med-v-podarochnoy-korzine frukty-i-shokolad-v-podarochnoy-korzine fruktovaya-korzina-na-den-rozhdeniya fruktovaya-korzina-na-yubiley fruktovaya-korzina-kollege fruktovaya-korzina-partneram korporativnye-fruktovye-korziny premialnaya-fruktovaya-korzina bolshaya-fruktovaya-korzina-v-podarok nebolshaya-fruktovaya-korzina-v-podarok fruktovaya-korzina-bez-sladostey fruktovaya-korzina-s-ekzoticheskimi-fruktami kak-vybrat-svezhie-frukty-dlya-podarka kak-hranit-fruktovuyu-korzinu-posle-dostavki kak-podobrat-frukty-po-sezonu kak-oformit-fruktovuyu-korzinu-v-podarok pochemu-fruktovaya-korzina-podhodit-dlya-delovogo-podarka frukty-i-chay-v-podarochnoy-korzine frukty-i-kofe-v-podarochnoy-korzine frukty-i-suhofrukty-v-podarochnoy-korzine
$aliases$), '\s+')
  );

comment on function public.sync_fruit_article_filters(jsonb) is
  'Upserts published fruit article profiles using actual catalog ingredients.';
