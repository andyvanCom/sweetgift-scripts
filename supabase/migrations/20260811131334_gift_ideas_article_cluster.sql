-- Configure the two latest general gift-idea article batches through the
-- existing article_product_filters -> article_product_cache ->
-- get_article_products() pipeline.

create or replace function public.sync_gift_idea_article_filters(p_articles jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_general text :=
    'сыр|камамбер|бри|горгонзол|колбас|мясо|паштет|риет|хамон|кофе|чай|шоколад|конфет|печенье|орех|миндал|фундук|кешью|мед|мёд|джем|фрукт|мандарин|апельсин|яблок|виноград|ананас';
  v_men text :=
    'колбас|мясо|паштет|риет|хамон|карпаччо|олени|лось|кабан|сыр|кофе|орех|миндал|фундук|кешью|чай';
  v_women text :=
    'чай|кофе|шоколад|конфет|печенье|мармелад|мед|мёд|джем|сыр|камамбер|бри|фрукт|мандарин|апельсин|яблок|виноград|ананас|манго|клубник';
  v_family text :=
    'чай|кофе|шоколад|конфет|печенье|мармелад|орех|мед|мёд|джем|сыр|мандарин|апельсин|яблок|виноград';
  v_professional text :=
    'чай|кофе|шоколад|конфет|печенье|орех|мед|мёд|джем|сыр';
  v_executive text :=
    'икра|краб|осетр|осётр|фуа-гра|фуагра|трюфел|хамон|лосос|форель|сыр|кофе';
  v_budget text :=
    'чай|кофе|шоколад|конфет|печенье|мармелад|джем';
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
85-chto-podarit blagodarnost-babushke blagodarnost-docheri blagodarnost-kollege blagodarnost-rukovoditelyu blagodarnost-vrachu blagodarnost-za-operatsiyu blagodarnost-za-rabotu blagodarnost-zhenshchine chto-muzhu-podarit-zhene chto-podarit chto-podarit-19 chto-podarit-30 chto-podarit-50 chto-podarit-55 chto-podarit-8 chto-podarit-babushke-i-dedushke chto-podarit-babushke-na-70 chto-podarit-byvshemu-na-den-rozhdeniya chto-podarit-byvshey chto-podarit-dedushke chto-podarit-derevyannoe chto-podarit-devushke-na-god chto-podarit-dorogo chto-podarit-kollege-zhenshchine chto-podarit-krestnoy chto-podarit-lyubimomu-cheloveku chto-podarit-mame chto-podarit-mame-8 chto-podarit-mame-na-50 chto-podarit-mame-na-60 chto-podarit-mame-na-65 chto-podarit-mame-na-yubiley chto-podarit-mame-ot-syna chto-podarit-muzhchine chto-podarit-muzhchine-na-35 chto-podarit-muzhchine-na-50 chto-podarit-muzhchine-na-55 chto-podarit-muzhchine-na-70 chto-podarit-muzhchine-na-yubiley chto-podarit-muzhchine-nedorogo chto-podarit-muzhu chto-podarit-muzhu-na-let chto-podarit-na-10-svadby chto-podarit-na-18 chto-podarit-na-21 chto-podarit-na-40 chto-podarit-na-45 chto-podarit-na-60 chto-podarit-na-den chto-podarit-na-god-svadby chto-podarit-na-godovshchinu chto-podarit-na-novosele chto-podarit-na-rozhdenie-devochki chto-podarit-na-rozhdenie-malchika chto-podarit-na-serebryanuyu chto-podarit-na-svidanii chto-podarit-na-yubiley chto-podarit-nedorogoe chto-podarit-ochen chto-podarit-ottsu-na-den chto-podarit-pape chto-podarit-pape-na-50 chto-podarit-pape-na-den chto-podarit-pape-na-yubiley chto-podarit-pape-ot-dochki chto-podarit-parnyu chto-podarit-parnyu-na-18 chto-podarit-parnyu-na-god chto-podarit-podruge chto-podarit-posle chto-podarit-pozhilym chto-podarit-prosto-tak chto-podarit-roditelyam-na-god chto-podarit-rozhdeniya-mame chto-podarit-rukovoditelyu chto-podarit-sosedu chto-podarit-starenkoy-mame chto-podarit-synu-ottsu chto-podarit-tete chto-podarit-vrachu chto-podarit-zhene-na-godovshchinu chto-podarit-zhene-na-rozhdenie chto-podarit-zhenshchine chto-podarit-zhenshchine-na-55 chto-podarit-zhenshchine-na-80 chto-podarit-zhenshchine-na-yubiley den-blagodarnosti-muzhu govorit-blagodarnosti idei-dlya-dnya-rozhdeniya idei-papa idei-podarkov-na-den-rozhdeniya ideya-pozdravleniya-mame kakoy-luchshiy-podarok-vybrat kakoy-podarok-mozhno-sdelat-mame-prosto-tak podarok-babushke podarok-babushke-na-65 podarok-babushke-na-8 podarok-drugu-30 podarok-drugu-na-20 podarok-mame-druga podarok-mame-na-novyy-god podarok-mame-podrugi podarok-na-godovshchinu-babushke podarok-novoy-babushke podarok-rukovoditelyu podborka-tovarov pozdravleniya-mamy-s-rozhdeniya-idei slova-blagodarnosti tekst-blagodarnosti
$aliases$), '\s+')
    )
      and trim(x.url) ~
        '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$'
  ),
  classified as (
    select
      s.*,
      case
        when s.alias ~ 'rukovoditel' then 'gift-ideas-executive'
        when s.alias ~ 'vrach|operatsiy' then 'gift-ideas-professional'
        when s.alias ~ 'kolleg|sosed' then 'gift-ideas-colleague'
        when s.alias ~ 'mame|mamy|mama|babush|zhensch|zhene|zhenu|devush|podruge|tete|krestn|docher|byvshey' then
          'gift-ideas-women'
        when s.alias ~ 'pape|papa|otts|muzh|muzhchin|parnyu|malchik|dedush|synu|drugu|byvshemu' then
          'gift-ideas-men'
        when s.alias ~ 'roditel|semeyn|lyubimomu-cheloveku' then
          'gift-ideas-family'
        when s.alias ~ 'dorogo|luchshiy' then 'gift-ideas-premium'
        when s.alias ~ 'nedorog' then 'gift-ideas-budget'
        else 'gift-ideas-general'
      end as cluster_key
    from source s
  ),
  prepared as (
    select
      c.alias,
      coalesce(c.title, 'Идеи подарков SweetGift') as title,
      c.article_url,
      c.cluster_key,
      case c.cluster_key
        when 'gift-ideas-men' then v_men
        when 'gift-ideas-women' then v_women
        when 'gift-ideas-family' then v_family
        when 'gift-ideas-professional' then v_professional
        when 'gift-ideas-executive' then v_executive
        when 'gift-ideas-colleague' then v_professional
        when 'gift-ideas-premium' then v_executive
        when 'gift-ideas-budget' then v_budget
        else v_general
      end as filter_value
    from classified c
  ),
  ordered as (
    select
      p.*,
      row_number() over (
        partition by p.cluster_key order by p.alias
      )::integer as cluster_order
    from prepared p
  )
  insert into public.article_product_filters (
    alias, filter_type, filter_value, title, subtitle, limit_count, enabled,
    cluster_key, cluster_order, article_url
  )
  select
    p.alias,
    'ingredient_contains',
    p.filter_value,
    p.title,
    case p.cluster_key
      when 'gift-ideas-men' then 'Гастрономические подарки SweetGift для мужчин'
      when 'gift-ideas-women' then 'Подарочные корзины и наборы SweetGift для женщин'
      when 'gift-ideas-family' then 'Подарки SweetGift для близких и семьи'
      when 'gift-ideas-professional' then 'Универсальные подарки SweetGift в знак благодарности'
      when 'gift-ideas-executive' then 'Премиальные подарки SweetGift для руководителей'
      when 'gift-ideas-colleague' then 'Универсальные подарки SweetGift для коллег'
      when 'gift-ideas-premium' then 'Премиальные подарочные корзины SweetGift'
      when 'gift-ideas-budget' then 'Доступные подарки SweetGift'
      else 'Популярные подарочные корзины и наборы SweetGift'
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
$function$;

revoke all on function public.sync_gift_idea_article_filters(jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_gift_idea_article_filters(jsonb)
  to service_role;

select public.sync_gift_idea_article_filters(
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
85-chto-podarit blagodarnost-babushke blagodarnost-docheri blagodarnost-kollege blagodarnost-rukovoditelyu blagodarnost-vrachu blagodarnost-za-operatsiyu blagodarnost-za-rabotu blagodarnost-zhenshchine chto-muzhu-podarit-zhene chto-podarit chto-podarit-19 chto-podarit-30 chto-podarit-50 chto-podarit-55 chto-podarit-8 chto-podarit-babushke-i-dedushke chto-podarit-babushke-na-70 chto-podarit-byvshemu-na-den-rozhdeniya chto-podarit-byvshey chto-podarit-dedushke chto-podarit-derevyannoe chto-podarit-devushke-na-god chto-podarit-dorogo chto-podarit-kollege-zhenshchine chto-podarit-krestnoy chto-podarit-lyubimomu-cheloveku chto-podarit-mame chto-podarit-mame-8 chto-podarit-mame-na-50 chto-podarit-mame-na-60 chto-podarit-mame-na-65 chto-podarit-mame-na-yubiley chto-podarit-mame-ot-syna chto-podarit-muzhchine chto-podarit-muzhchine-na-35 chto-podarit-muzhchine-na-50 chto-podarit-muzhchine-na-55 chto-podarit-muzhchine-na-70 chto-podarit-muzhchine-na-yubiley chto-podarit-muzhchine-nedorogo chto-podarit-muzhu chto-podarit-muzhu-na-let chto-podarit-na-10-svadby chto-podarit-na-18 chto-podarit-na-21 chto-podarit-na-40 chto-podarit-na-45 chto-podarit-na-60 chto-podarit-na-den chto-podarit-na-god-svadby chto-podarit-na-godovshchinu chto-podarit-na-novosele chto-podarit-na-rozhdenie-devochki chto-podarit-na-rozhdenie-malchika chto-podarit-na-serebryanuyu chto-podarit-na-svidanii chto-podarit-na-yubiley chto-podarit-nedorogoe chto-podarit-ochen chto-podarit-ottsu-na-den chto-podarit-pape chto-podarit-pape-na-50 chto-podarit-pape-na-den chto-podarit-pape-na-yubiley chto-podarit-pape-ot-dochki chto-podarit-parnyu chto-podarit-parnyu-na-18 chto-podarit-parnyu-na-god chto-podarit-podruge chto-podarit-posle chto-podarit-pozhilym chto-podarit-prosto-tak chto-podarit-roditelyam-na-god chto-podarit-rozhdeniya-mame chto-podarit-rukovoditelyu chto-podarit-sosedu chto-podarit-starenkoy-mame chto-podarit-synu-ottsu chto-podarit-tete chto-podarit-vrachu chto-podarit-zhene-na-godovshchinu chto-podarit-zhene-na-rozhdenie chto-podarit-zhenshchine chto-podarit-zhenshchine-na-55 chto-podarit-zhenshchine-na-80 chto-podarit-zhenshchine-na-yubiley den-blagodarnosti-muzhu govorit-blagodarnosti idei-dlya-dnya-rozhdeniya idei-papa idei-podarkov-na-den-rozhdeniya ideya-pozdravleniya-mame kakoy-luchshiy-podarok-vybrat kakoy-podarok-mozhno-sdelat-mame-prosto-tak podarok-babushke podarok-babushke-na-65 podarok-babushke-na-8 podarok-drugu-30 podarok-drugu-na-20 podarok-mame-druga podarok-mame-na-novyy-god podarok-mame-podrugi podarok-na-godovshchinu-babushke podarok-novoy-babushke podarok-rukovoditelyu podborka-tovarov pozdravleniya-mamy-s-rozhdeniya-idei slova-blagodarnosti tekst-blagodarnosti
$aliases$), '\s+')
  );

comment on function public.sync_gift_idea_article_filters(jsonb) is
  'Upserts the two latest general gift-idea batches using real catalog ingredient profiles.';
