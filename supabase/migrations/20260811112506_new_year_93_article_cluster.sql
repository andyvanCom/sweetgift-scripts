-- Configure the 93-article New Year cluster through the existing
-- article_product_filters -> article_product_cache -> get_article_products()
-- pipeline. New Year/recipient labels are not invented as product tags:
-- every intent maps to real ingredient profiles already used by the catalog.

create or replace function public.sync_new_year_article_filters(p_articles jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_general text :=
    'сыр|камамбер|бри|горгонзол|колбас|мясо|паштет|риет|хамон|кофе|чай|шоколад|конфет|печенье|орех|миндал|фундук|кешью|мед|мёд|джем|мандарин|апельсин|яблок|виноград|ананас';
  v_men text :=
    'колбас|мясо|паштет|риет|хамон|карпаччо|олени|лось|кабан|сыр|кофе|орех|миндал|фундук|кешью';
  v_women text :=
    'чай|кофе|шоколад|конфет|печенье|мармелад|мед|мёд|джем|сыр|камамбер|бри|фрукт|мандарин|апельсин|яблок|виноград|ананас|манго|клубник';
  v_family text :=
    'чай|кофе|шоколад|конфет|печенье|мармелад|орех|мед|мёд|джем|мандарин|апельсин|яблок|виноград';
  v_professional text :=
    'чай|кофе|шоколад|конфет|печенье|орех|мед|мёд|джем|сыр';
  v_executive text :=
    'икра|краб|осетр|осётр|фуа-гра|фуагра|трюфел|хамон|лосос|форель|сыр|кофе';
  v_corporate text :=
    'чай|кофе|шоколад|конфет|печенье|мармелад|орех|миндал|фундук|кешью|мед|мёд|джем';
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
novyy-god-zhenshchiny podarki-na-novyy-god novyy-god-vybiray muzhchina-na-novyy-god kupit-rozhdestvenskie novym-godom-drug-drugom novyy-god-s-drugom novym-godom-muzh devushka-novaya-godom novym-godom-sotrudnikov mamam-na-novyy-god novyy-god-syna s-novym-godom-mamy uchitel-novyy-god muzh-na-novyy-god direktor-novyy-god nabory-novyy-god devochki-na-novyy-god drug-na-novyy-god roditelya-na-novyy-god paren-novyy-god novogodniy-podarok-druzyam novyy-god-byvshiy-muzh novyy-god-klienty novyy-god-podruga pozdravlyayu-s-dnem-novym-godom rozhdestvo-s-drugom idei-na-novye-god papy-na-novyy-god mama-syn-novyy-god svekrov-novyy-god vrach-novyy-god podarki-novyy-god-byvshemu nabor-na-novyy-god vzroslyh-na-novyy-god s-novym-godom-bratya docheri-na-novyy-god pozdravit-byvshego-s-novym-godom pozdravlyayu-s-novym-godom-rozhdeniya s-novym-godom-byvshemu-muzhchine druzya-rozhdestvo novyy-uchebnyy-god-uchitel idei-dlya-novogo-goda sestry-na-novyy-god na-novyy-god-nedorogoe korporativnye-novogodnie-podarki novym-godom-partnery zakaza-novyy-god k-druzyam-novyy-god dedushka-novyy-god roditeli-roditeley-novogodnie podarki-na-2027 byvshaya-devushka-novyy-god bratu-na-novyy-god buhgalter-novyy-god podarok-byvshey-na-novyy-god mame-k-novomu-godu novogodniy-podarok-sotrudnik s-novym-godom-molodogo-muzhchinu partner-na-novyy-god novym-godom-nachalnika novym-godom-klassnomu-rukovoditelyu novym-godom-vospitateley s-novym-godom-zhizni-lyubimogo novyy-god-s-muzhem-doma zimnee-utro-druzya novyy-god-menedzher lyubimoy-babushke-v-novyy-god rozhdestvo-zhenu rozhdestvo-roditelyam zhene-k-novomu-godu trener-novyy-god s-novym-godom-pozdravit-pervoy pozdravim-godom-i-rozhdestvom syurpriz-na-novyy-god novyy-god-2026-pozdravit tekst-babushke-na-novyy-god muzhu-na-rozhdestvo na-novyy-god-zhenshchinam-muzhchinam novyy-devochke-18-let novogodniy-podarok-tsena novym-godom-uvazhaemye-roditeli dorogaya-mama-s-novym-godom blagodarnost-novyy-god podarki-klientov-na-novyy-god novogodniy-doktor klassnomu-rukovoditelyu-na-novyy-god korporativnye-idei-na-novyy-god rozhdestvenskaya-ideya novogodniy-bolshie-podarki teshcha-na-novyy-god uvazhaemye-pozdravlyaem-s-novym-godom idei-korporativnyh-podarkov-na-novyy-god
$aliases$), '\s+')
    )
      and trim(x.url) ~
        '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$'
  ),
  classified as (
    select
      s.*,
      case
        when s.alias ~
          'direktor|nachalnik|partner|klient' then 'new-year-executive'
        when s.alias ~
          'korporativ|sotrudnik|menedzher|buhgalter' then 'new-year-corporate'
        when s.alias ~
          'uchitel|klassnomu-rukovoditelyu|vospitatel|vrach|doktor|trener' then
          'new-year-professional'
        when s.alias ~
          'muzh|muzhchin|paren|papy|dedush|bratu|syna|lyubimogo|byvshego' then
          'new-year-men'
        when s.alias ~
          'zhensch|devush|devochk|mamy|mamam|mame|podruga|svekrov|docher|sestry|byvshey|babush|zhenu|zhene|teshcha' then
          'new-year-women'
        when s.alias ~ 'roditel|druz|drug|vzroslyh|s-muzhem-doma' then
          'new-year-family'
        when s.alias ~ 'nedorog|tsena' then 'new-year-budget'
        else 'new-year-general'
      end as cluster_key
    from source s
  ),
  prepared as (
    select
      c.alias,
      coalesce(c.title, 'Новогодние подарки SweetGift') as title,
      c.article_url,
      c.cluster_key,
      case c.cluster_key
        when 'new-year-men' then v_men
        when 'new-year-women' then v_women
        when 'new-year-family' then v_family
        when 'new-year-professional' then v_professional
        when 'new-year-executive' then v_executive
        when 'new-year-corporate' then v_corporate
        when 'new-year-budget' then v_budget
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
      when 'new-year-men' then
        'Гастрономические новогодние подарки SweetGift для мужчин'
      when 'new-year-women' then
        'Новогодние корзины и наборы SweetGift для женщин'
      when 'new-year-family' then
        'Новогодние подарки SweetGift для близких и друзей'
      when 'new-year-professional' then
        'Универсальные новогодние подарки SweetGift в знак благодарности'
      when 'new-year-executive' then
        'Премиальные новогодние подарки SweetGift'
      when 'new-year-corporate' then
        'Корпоративные новогодние подарки SweetGift'
      when 'new-year-budget' then
        'Доступные новогодние подарки SweetGift'
      else 'Популярные новогодние подарки SweetGift'
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

revoke all on function public.sync_new_year_article_filters(jsonb) from public;
grant execute on function public.sync_new_year_article_filters(jsonb)
  to service_role;

-- Seed any articles that have already reached articles_index. The same RPC is
-- called by import-articles-index for newly published Tilda Flow articles.
select public.sync_new_year_article_filters(
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
novyy-god-zhenshchiny podarki-na-novyy-god novyy-god-vybiray muzhchina-na-novyy-god kupit-rozhdestvenskie novym-godom-drug-drugom novyy-god-s-drugom novym-godom-muzh devushka-novaya-godom novym-godom-sotrudnikov mamam-na-novyy-god novyy-god-syna s-novym-godom-mamy uchitel-novyy-god muzh-na-novyy-god direktor-novyy-god nabory-novyy-god devochki-na-novyy-god drug-na-novyy-god roditelya-na-novyy-god paren-novyy-god novogodniy-podarok-druzyam novyy-god-byvshiy-muzh novyy-god-klienty novyy-god-podruga pozdravlyayu-s-dnem-novym-godom rozhdestvo-s-drugom idei-na-novye-god papy-na-novyy-god mama-syn-novyy-god svekrov-novyy-god vrach-novyy-god podarki-novyy-god-byvshemu nabor-na-novyy-god vzroslyh-na-novyy-god s-novym-godom-bratya docheri-na-novyy-god pozdravit-byvshego-s-novym-godom pozdravlyayu-s-novym-godom-rozhdeniya s-novym-godom-byvshemu-muzhchine druzya-rozhdestvo novyy-uchebnyy-god-uchitel idei-dlya-novogo-goda sestry-na-novyy-god na-novyy-god-nedorogoe korporativnye-novogodnie-podarki novym-godom-partnery zakaza-novyy-god k-druzyam-novyy-god dedushka-novyy-god roditeli-roditeley-novogodnie podarki-na-2027 byvshaya-devushka-novyy-god bratu-na-novyy-god buhgalter-novyy-god podarok-byvshey-na-novyy-god mame-k-novomu-godu novogodniy-podarok-sotrudnik s-novym-godom-molodogo-muzhchinu partner-na-novyy-god novym-godom-nachalnika novym-godom-klassnomu-rukovoditelyu novym-godom-vospitateley s-novym-godom-zhizni-lyubimogo novyy-god-s-muzhem-doma zimnee-utro-druzya novyy-god-menedzher lyubimoy-babushke-v-novyy-god rozhdestvo-zhenu rozhdestvo-roditelyam zhene-k-novomu-godu trener-novyy-god s-novym-godom-pozdravit-pervoy pozdravim-godom-i-rozhdestvom syurpriz-na-novyy-god novyy-god-2026-pozdravit tekst-babushke-na-novyy-god muzhu-na-rozhdestvo na-novyy-god-zhenshchinam-muzhchinam novyy-devochke-18-let novogodniy-podarok-tsena novym-godom-uvazhaemye-roditeli dorogaya-mama-s-novym-godom blagodarnost-novyy-god podarki-klientov-na-novyy-god novogodniy-doktor klassnomu-rukovoditelyu-na-novyy-god korporativnye-idei-na-novyy-god rozhdestvenskaya-ideya novogodniy-bolshie-podarki teshcha-na-novyy-god uvazhaemye-pozdravlyaem-s-novym-godom idei-korporativnyh-podarkov-na-novyy-god
$aliases$), '\s+')
  );

comment on function public.sync_new_year_article_filters(jsonb) is
  'Upserts the exact 93-article New Year cluster using real catalog ingredient profiles.';
