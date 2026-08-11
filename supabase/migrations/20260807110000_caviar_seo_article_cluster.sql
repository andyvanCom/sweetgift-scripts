-- Configure the published caviar SEO cluster through the existing
-- article_product_filters -> article_product_cache -> get_article_products()
-- pipeline. Pairings use mandatory groups separated by &&.

create or replace function public.sync_caviar_article_filters(p_articles jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caviar text :=
    'икра красн|икры красн|икра лосос|икра горбуш|икра осетр|икра осётр|икра черная осетр|икра чёрная осетр|икра щук|риет из икры треск';
  v_red text :=
    'икра красн|икры красн|икра лосос|икра горбуш|икра "красное золото"|икра красное золото';
  v_salmon text :=
    'икра лосос|икра горбуш|красное золото горбуш';
  v_gorbusha text :=
    'икра горбуш|красное золото горбуш';
  v_sturgeon text :=
    'икра осетр|икра осётр|икра черная осетр|икра чёрная осетр';
  v_black_sturgeon text :=
    'икра осетровая черная|икра осетровая чёрная|икра черная осетровая|икра чёрная осетровая';
  v_granular_sturgeon text :=
    'икра осетра зернист';
  v_pike text := 'икра щук';
  v_pasteurized_pike text := 'икра щуки пастеризован';
  v_krasnoe_zoloto text :=
    'икра красная красное золото|икра красная "красное золото"|икра "красное золото"|икра лососёвых рыб зернистая, «красное золото»|икра лососевая зернистая красное золото|икра красное золото горбуша';
  v_krasnoe_zoloto_200 text :=
    'икра красная красное золото 200 грамм|икра лососевая зернистая красное золото, 200 грамм|икра красное золото горбуша зернистая, 200 грамм';
  v_krasnoe_zoloto_230 text :=
    'икра красная красное золото 230 грамм|икра красное золото 230 грамм';
  v_cheese text :=
    'сыр|камамбер|бри|горгонзол|маасдам|чеддер|пармезан';
  v_meat text :=
    'колбас|мясо|паштет|риет|хамон|карпаччо|деликатес';
  v_nuts text :=
    'орех|миндал|фундук|кешью|пекан|фисташ|арахис';
  v_honey text :=
    'мед натуральный|мёд натуральный|мед цветоч|мёд цветоч|крем-мед|крем-мёд|мед-суфле|мёд-суфле';
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
    where lower(trim(x.alias)) ~ '(^|-)(ikra|ikroy|ikry)(-|$)'
      and trim(x.url) ~
        '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$'
  ),
  classified as (
    select
      s.*,
      case
        when s.alias ~ 'krasnaya-i-chernaya-ikra' then
          v_red || '&&' || v_black_sturgeon
        when s.alias ~ 'neskolko-vidov-ikry' then
          v_red || '&&' || v_sturgeon || '|' || v_pike
        when s.alias ~ 'ikra-krasnoe-zoloto-200' then
          v_krasnoe_zoloto_200
        when s.alias ~ 'ikra-krasnoe-zoloto-230' then
          v_krasnoe_zoloto_230
        when s.alias ~ 'ikra-krasnoe-zoloto' then v_krasnoe_zoloto
        when s.alias ~ 'pasterizovannaya-ikra-shchuki' then
          v_pasteurized_pike
        when s.alias ~ 'ikra-shchuki' then v_pike
        when s.alias ~ 'zernistaya-ikra-osetra' then v_granular_sturgeon
        when s.alias ~ 'chernaya-osetrovaya-ikra' then v_black_sturgeon
        when s.alias ~ 'osetrovaya-ikra' then v_sturgeon
        when s.alias ~ 'ikra-gorbushi' then v_gorbusha
        when s.alias ~ 'lososevaya-ikra' then v_salmon
        when s.alias ~ 'krasnaya-ikra' then v_red
        else v_caviar
      end as caviar_filter,
      case
        when s.alias ~ 'ikra-i-syr' then v_cheese
        when s.alias ~ 'ikra-i-krab' then 'краб'
        when s.alias ~ 'ikra-i-myasnye-delikatesy' then v_meat
        when s.alias ~ 'ikra-i-kofe' then 'кофе'
        when s.alias ~ 'ikra-i-chay' then 'чай'
        when s.alias ~ 'ikra-i-orekhi' then v_nuts
        when s.alias ~ 'ikra-i-med' then v_honey
        when s.alias ~ 'korzina-s-ikroy-i-delikatesami' then
          'краб|сыр|колбас|мясо|паштет|риет|хамон|фуа-гра|фуагра|трюфел'
        when s.alias ~ 'korzina-s-ikroy-i-napitkami' then
          'вино|шампан|водк|коньяк|виски|игрист|напиток'
        when s.alias ~
          'rukovoditelyu|direktoru|partneru|klientu|premium|delovaya' then
          'краб|фуа-гра|фуагра|трюфел|хамон|сыр'
        when s.alias ~ 'muzhchine|23-fevralya' then v_meat || '|' || v_cheese
        when s.alias ~ 'zhenshchine|8-marta' then
          v_cheese || '|фрукт|шоколад|конфет'
        when s.alias ~ 'novogodnaya-korzina' then
          'новогодн|рождеств|живая ель|нобилис|хвоя'
        else null
      end as secondary_filter,
      case
        when s.alias ~
          '(^|-)i-(syr|krab|myasnye|kofe|chay|orekhi|med)(-|$)|i-delikatesami|i-napitkami' then
          'caviar-pairings'
        when s.alias ~
          'krasnaya-i-chernaya|neskolko-vidov|krasnoe-zoloto|lososevaya|gorbushi|osetrovaya|zernistaya|shchuki' then
          'caviar-types'
        when s.alias ~
          'rukovoditelyu|direktoru|muzhchine|zhenshchine|kollege|partneru|klientu|roditelyam|druzyam|korporativ|novogod|den-rozhdeniya|yubiley|23-fevralya|8-marta|godovshchinu|novosele|semeynogo|premium|nebolshaya|bolshaya|delovaya|dostavkoy|bez-alkogolya' then
          'caviar-gifts'
        else 'caviar-guides'
      end as cluster_key
    from source s
  ),
  prepared as (
    select
      c.alias,
      coalesce(c.title, 'Подарочные корзины SweetGift с икрой') as title,
      c.article_url,
      case
        when c.secondary_filter is null
             and position('&&' in c.caviar_filter) = 0 then
          'ingredient_contains'
        else 'ingredient_all_contains'
      end as filter_type,
      case
        when c.secondary_filter is null then c.caviar_filter
        else c.caviar_filter || '&&' || c.secondary_filter
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
      when 'caviar-pairings' then
        'Подарочные корзины SweetGift с икрой и выбранным сочетанием'
      when 'caviar-types' then
        'Корзины SweetGift с выбранным видом икры'
      when 'caviar-gifts' then
        'Подарочные корзины SweetGift с икрой'
      else 'Популярные корзины SweetGift с икрой'
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

revoke all on function public.sync_caviar_article_filters(jsonb) from public;
grant execute on function public.sync_caviar_article_filters(jsonb)
  to service_role;

-- Seed all already indexed articles whose data-alias contains the caviar token.
select public.sync_caviar_article_filters(
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
  and regexp_replace(a.url, '^.*/', '') ~ '(^|-)(ikra|ikroy|ikry)(-|$)'
  and a.url ~ '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$';

comment on function public.sync_caviar_article_filters(jsonb) is
  'Upserts published caviar article profiles using actual catalog ingredients.';
