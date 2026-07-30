-- Give every honey article its own filter Alias and navigation URL while
-- keeping the existing article_product_filters/cache/RPC architecture.
-- Pairing articles use AND groups separated by &&, with | alternatives
-- inside each group.

alter table public.article_product_filters
  drop constraint if exists article_product_filters_filter_type;

alter table public.article_product_filters
  add constraint article_product_filters_filter_type
  check (
    filter_type in (
      'tag',
      'ingredient',
      'ingredient_contains',
      'ingredient_all_contains'
    )
  );

create or replace function public.sync_honey_article_filters(p_articles jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_honey text :=
    'мед натуральный|мёд натуральный|мед цветоч|мёд цветоч|цветочный мед|цветочный мёд|мед в сотах|мёд в сотах|мед суфле|мёд суфле|мед-суфле|мёд-суфле|крем мед|крем мёд|крем-мед|крем-мёд|мед медолюбов|мёд медолюбов|медовый десерт|орехи в меду|миндаль в меду|фундук в меду|кешью в меду|мед с апельсином|мёд с апельсином|мед с облепихой|мёд с облепихой';
  v_cheese text :=
    'камамбер|camembert|сыр бри|сыр brie|горгонзол|gorgonzol|рокфор|rockforo|roquefort|дорблю|dorblu|blue cheese|маасдам|масдам|чеддер|чеддар|cheddar|пармезан|parmigiano|гауда|gouda';
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
    where lower(trim(x.alias)) ~
      '(^|-)(med|meda|mede|medom|medovyy|medovaya|medovom)(-|$)'
      and trim(x.url) ~
        '^https://sweetgift[.]ru/stati/[a-z0-9][a-z0-9-]*/?$'
  ),
  classified as (
    select
      s.*,
      case
        when s.alias in (
          'med-i-syr',
          'syr-i-med',
          'syr-i-med-sochetaniya',
          'med-i-kamamber',
          'med-i-bri',
          'med-i-goluboy-syr',
          'med-i-parmezan',
          'med-i-koziy-syr',
          'syrnaya-korzina-s-medom',
          'nabor-s-medom-i-syrom'
        ) then v_cheese
        when s.alias in (
          'med-i-chay',
          'kakoy-med-vybrat-k-chayu',
          'chaynyy-nabor-s-medom',
          'nabor-s-medom-i-chaem'
        ) then 'чай'
        when s.alias in (
          'med-i-kofe',
          'nabor-s-medom-i-kofe'
        ) then 'кофе'
        when s.alias in (
          'med-i-orehi',
          'orehovyy-nabor-s-medom',
          'nabor-s-medom-i-orehami'
        ) then 'орех|миндаль|фундук|кешью|грецкий|кедров'
        when s.alias = 'med-i-mindal' then 'миндаль'
        when s.alias = 'med-i-funduk' then 'фундук'
        when s.alias = 'med-i-keshyu' then 'кешью'
        when s.alias = 'med-i-gretskiy-oreh' then 'грецкий орех'
        when s.alias = 'med-i-kedrovye-orehi' then 'кедров'
        when s.alias = 'med-i-yabloki' then 'яблок'
        when s.alias = 'med-i-grusha' then 'груш'
        when s.alias = 'med-i-vinograd' then 'виноград'
        when s.alias = 'med-i-inzhir' then 'инжир'
        when s.alias = 'med-i-suhofrukty' then
          'сухофрукт|финик|курага|чернослив|изюм'
        when s.alias in ('med-i-yagody', 'med-s-lesnymi-yagodami') then
          'ягод|малина|ежевика|черника|клубника|брусника|клюква'
        when s.alias = 'fruktovaya-korzina-s-medom' then
          'яблок|груш|виноград|инжир|апельсин|мандарин|манго|ананас'
        else null
      end as secondary_filter,
      case
        when s.alias = 'med-naturalnyy-lesnoy' then
          'мед натуральный лесной|мёд натуральный лесной'
        when s.alias = 'med-tsvetochnyy-v-sotah' then
          'мед цветочный в сотах|мёд цветочный в сотах'
        when s.alias = 'med-tsvetochnyy-s-novym-godom' then
          'мед цветочный с новым годом|мёд цветочный с новым годом'
        when s.alias = 'med-tsvetochnyy-moroznoe-utro' then
          'мед цветочный морозное утро|мёд цветочный морозное утро'
        when s.alias = 'med-tsvetochnyy' then
          'мед цветоч|мёд цветоч|цветочный мед|цветочный мёд'
        when s.alias = 'med-chernoklenovyy' then 'чернокленов'
        when s.alias = 'med-lavandovyy' then 'медолюбов лавандов|мёд лавандов'
        when s.alias = 'med-sufle-s-kedrovymi-orehami' then
          'мед суфле с кедров|мёд суфле с кедров|мед-суфле с кедров|мёд-суфле с кедров'
        when s.alias = 'vzbityy-krem-med' then
          'взбитый крем мед|взбитый крем мёд|крем мед медолюбов|крем-мед медолюбов'
        when s.alias in ('krem-med-s-malinoy', 'med-s-malinoy-vkus-i-podacha') then
          'крем мед медолюбов с малиной|крем мед медолюбов в малиной|крем-мед с малиной'
        when s.alias = 'krem-med-s-ezhevikoy' then
          'крем мед медолюбов с ежевикой|крем-мед с ежевикой'
        when s.alias = 'krem-med-s-chernikoy' then
          'крем мед медолюбов с черникой|крем-мед с черникой'
        when s.alias = 'krem-med-s-klubnikoy' then
          'мед медолюбов клубника|мёд медолюбов клубника|крем-мед с клубникой'
        when s.alias = 'krem-med-s-vishney' then
          'крем мед медолюбов с вишней|крем-мед с вишней'
        when s.alias = 'krem-med-s-mango' then
          'крем мед медолюбов с манго|крем-мед с манго'
        when s.alias in ('krem-med-s-apelsinom', 'med-s-apelsinom-vkus-i-podacha') then
          'крем мед с апельсином|крем-мед с апельсином'
        when s.alias = 'krem-med-s-dyney' then
          'крем мед медолюбов с дыней|крем-мед с дыней'
        when s.alias in ('krem-med-s-oblepihoy', 'med-s-oblepihoy-vkus-i-podacha') then
          'крем мед с облепихой|крем-мед с облепихой'
        when s.alias = 'krem-med-s-fundukom' then
          'крем мед медолюбов с фундуком|крем-мед с фундуком'
        when s.alias in ('krem-med-lesnye-yagody', 'med-s-lesnymi-yagodami') then
          'крем мед медолюбов лесные ягоды|крем-мед лесные ягоды'
        when s.alias in (
          'krem-med-glintveyn',
          'krem-med-glintveyn-v-novogodnem-nabore'
        ) then 'крем мед глинтвейн|крем-мед глинтвейн'
        when s.alias = 'krem-med-solenaya-karamel' then
          'крем мед соленая карамель|крем-мед соленая карамель'
        when s.alias = 'medovyy-desert-chernoklenovyy' then
          'медовый десерт медолюбов чернокленовый|медовый десерт чернокленовый'
        when s.alias = 'medovyy-desert-solenaya-karamel' then
          'медовый десерт медолюбов солёная карамель|медовый десерт соленая карамель'
        when s.alias = 'medovyy-desert-s-fundukom' then
          'медовый десерт с фундуком'
        when s.alias = 'medovyy-desert-s-keshyu' then
          'медовый десерт с кешью|кешью в меду'
        when s.alias = 'medovyy-desert' then 'медовый десерт'
        when s.alias = 'orehi-v-mede' then 'орехи в меду|медовый десерт'
        when s.alias = 'mindal-v-mede' then 'миндаль в меду'
        when s.alias = 'funduk-v-mede' then 'фундук в меду'
        when s.alias = 'keshyu-v-mede' then 'кешью в меду'
        else null
      end as specific_filter
    from source s
  ),
  prepared as (
    select
      c.alias,
      coalesce(c.title, initcap(replace(c.alias, '-', ' '))) as title,
      c.article_url,
      case
        when c.secondary_filter is not null then 'ingredient_all_contains'
        else 'ingredient_contains'
      end as filter_type,
      coalesce(
        c.specific_filter,
        case
          when c.secondary_filter is not null then
            v_honey || '&&' || c.secondary_filter
          else v_honey
        end
      ) as filter_value,
      case
        when c.secondary_filter = v_cheese then 'honey-cheese'
        when c.secondary_filter in ('чай', 'кофе') then 'honey-drinks'
        when c.secondary_filter ~ 'орех|миндаль|фундук|кешью|грецкий|кедров' then
          'honey-nuts'
        when c.secondary_filter is not null then 'honey-fruit'
        when c.alias ~ 'krem-med|krem-meda' then 'honey-cream'
        when c.alias ~
          'medovyy-desert|orehi-v-mede|mindal-v-mede|funduk-v-mede|keshyu-v-mede|med-sufle' then
          'honey-products'
        when c.alias ~
          'novogod|novym-godom|moroznoe-utro|glintveyn-v-novogod' then
          'honey-seasonal'
        when c.alias ~
          'v-podarok|podarki-|korporativ|na-den-rozhdeniya|na-8-marta|na-23-fevralya|uchitelyu|vrachu|lyubitelyu' then
          'honey-gifts'
        when c.alias ~ 'korzina|nabor|sobrat|polozhit' then 'honey-guides'
        else 'honey-knowledge'
      end as cluster_key
    from classified c
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
      when 'honey-cheese' then 'Корзины SweetGift, где мёд сочетается с сыром'
      when 'honey-drinks' then 'Корзины SweetGift с мёдом и подходящими напитками'
      when 'honey-nuts' then 'Корзины SweetGift с мёдом и орехами'
      when 'honey-fruit' then 'Корзины SweetGift с мёдом, фруктами и ягодами'
      when 'honey-cream' then 'Корзины SweetGift с подходящим видом крем-мёда'
      when 'honey-products' then 'Корзины SweetGift с выбранным медовым продуктом'
      when 'honey-seasonal' then 'Сезонные и новогодние корзины SweetGift с мёдом'
      when 'honey-gifts' then 'Подарочные корзины SweetGift с натуральным мёдом'
      when 'honey-guides' then 'Корзины и наборы SweetGift с мёдом'
      else 'Подарочные корзины SweetGift с натуральным мёдом'
    end,
    12,
    true,
    p.cluster_key,
    0,
    p.article_url
  from prepared p
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

revoke all on function public.sync_honey_article_filters(jsonb) from public;
grant execute on function public.sync_honey_article_filters(jsonb)
  to service_role;

create or replace function public.refresh_article_product_cache()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_refreshed_at timestamptz := clock_timestamp();
  v_job_id bigint;
  v_rows bigint := 0;
  v_aliases bigint := 0;
begin
  perform pg_advisory_xact_lock(7339471381);

  insert into public.system_job_logs (job_name, started_at, status)
  values ('refresh-article-product-cache', v_started_at, 'running')
  returning id into v_job_id;

  begin
    delete from public.article_product_cache
    where article_alias is not null;

    insert into public.article_product_cache (
      article_alias,
      product_key,
      rank,
      match_precision,
      popularity_score,
      matched_ingredients,
      refreshed_at
    )
    with
    filter_definitions as materialized (
      select distinct
        md5(
          f.filter_type || E'\n' ||
          f.filter_value || E'\n' ||
          f.limit_count::text
        ) as filter_key,
        f.filter_type,
        f.filter_value,
        f.limit_count
      from public.article_product_filters f
      where f.enabled = true
    ),
    filter_aliases as materialized (
      select
        md5(
          f.filter_type || E'\n' ||
          f.filter_value || E'\n' ||
          f.limit_count::text
        ) as filter_key,
        f.alias
      from public.article_product_filters f
      where f.enabled = true
    ),
    filter_groups as materialized (
      select
        f.filter_key,
        f.filter_type,
        f.limit_count,
        groups.ordinality::integer as group_no,
        count(*) over (partition by f.filter_key)::integer as group_count,
        groups.value as group_value
      from filter_definitions f
      cross join lateral (
        select f.filter_value as value, 1::bigint as ordinality
        where f.filter_type <> 'ingredient_all_contains'
        union all
        select split.value, split.ordinality
        from regexp_split_to_table(
          f.filter_value,
          '\s*&&\s*'
        ) with ordinality as split(value, ordinality)
        where f.filter_type = 'ingredient_all_contains'
      ) as groups
    ),
    needles as materialized (
      select
        g.filter_key,
        g.filter_type,
        g.limit_count,
        g.group_no,
        g.group_count,
        lower(trim(parts.value)) as value
      from filter_groups g
      cross join lateral regexp_split_to_table(
        g.group_value,
        '\s*\|\s*'
      ) as parts(value)
      where nullif(trim(parts.value), '') is not null
    ),
    matched_products as materialized (
      select
        n.filter_key,
        n.filter_type,
        n.limit_count,
        p.product_key,
        p.price,
        p.title,
        max(
          case
            when n.filter_type in (
              'ingredient_contains',
              'ingredient_all_contains'
            )
            and lower(trim(coalesce(pi.ingredient_raw, ''))) = n.value
              then 100
            when n.filter_type in (
              'ingredient_contains',
              'ingredient_all_contains'
            )
            and position(
              n.value in lower(coalesce(pi.ingredient_raw, ''))
            ) = 1
              then 90
            when n.filter_type in (
              'ingredient_contains',
              'ingredient_all_contains'
            ) then 80
            else 50
          end
        ) as match_precision,
        array_agg(distinct pi.ingredient_raw)
          filter (where pi.ingredient_raw is not null) as matched_ingredients
      from needles n
      join public.product_ingredients pi on
        (
          n.filter_type = 'tag'
          and lower(trim(coalesce(pi.tag, ''))) = n.value
          and not (
            n.value = 'cheese'
            and lower(coalesce(pi.ingredient_raw, '')) ~ 'сырокоп|сыровял'
          )
        )
        or (
          n.filter_type = 'ingredient'
          and lower(trim(coalesce(pi.ingredient_raw, ''))) = n.value
        )
        or (
          n.filter_type in (
            'ingredient_contains',
            'ingredient_all_contains'
          )
          and (
            position(
              n.value in lower(coalesce(pi.ingredient_raw, ''))
            ) > 0
            or position(
              n.value in lower(coalesce(pi.ingredient_normalized, ''))
            ) > 0
          )
        )
      join public.products_catalog p on p.product_key = pi.product_key
      where p.available = true
        and (
          lower(coalesce(p.category_slug, '')) ~ '(korzin|basket)'
          or (
            lower(coalesce(p.category_slug, '')) in ('', 'tproduct')
            and (
              lower(coalesce(p.title, '')) like '%корзин%'
              or lower(coalesce(p.product_key, '')) like '%korzin%'
            )
          )
        )
      group by
        n.filter_key,
        n.filter_type,
        n.limit_count,
        p.product_key,
        p.price,
        p.title
      having count(distinct n.group_no) = max(n.group_count)
    ),
    popularity as materialized (
      select
        e.product_key,
        sum(
          case e.event_type
            when 'purchase' then 10
            when 'add_to_cart' then 4
            when 'favorite' then 3
            when 'listing_click' then 2
            when 'view' then 1
            else 0
          end
        )::bigint as popularity_score
      from public.product_events e
      where exists (
        select 1
        from matched_products m
        where m.product_key = e.product_key
      )
      group by e.product_key
    ),
    ranked as (
      select
        m.filter_key,
        m.product_key,
        row_number() over (
          partition by m.filter_key
          order by
            case
              when m.filter_type = 'tag' then 0
              else m.match_precision
            end desc,
            coalesce(pop.popularity_score, 0) desc,
            m.price asc nulls last,
            m.title asc
        )::integer as rank,
        m.match_precision,
        coalesce(pop.popularity_score, 0) as popularity_score,
        coalesce(m.matched_ingredients, '{}'::text[]) as matched_ingredients,
        m.limit_count
      from matched_products m
      left join popularity pop on pop.product_key = m.product_key
    ),
    expanded as (
      select
        a.alias as article_alias,
        r.product_key,
        r.rank,
        r.match_precision,
        r.popularity_score,
        r.matched_ingredients
      from ranked r
      join filter_aliases a on a.filter_key = r.filter_key
      where r.rank <= r.limit_count
    )
    select
      e.article_alias,
      e.product_key,
      e.rank,
      e.match_precision,
      e.popularity_score,
      e.matched_ingredients,
      v_refreshed_at
    from expanded e;

    get diagnostics v_rows = row_count;

    select count(distinct c.article_alias)
    into v_aliases
    from public.article_product_cache c;
  exception
    when others then
      update public.system_job_logs
      set
        finished_at = clock_timestamp(),
        status = 'error',
        duration_ms = floor(
          extract(epoch from (clock_timestamp() - v_started_at)) * 1000
        )::bigint,
        error_message = sqlerrm,
        details = jsonb_build_object(
          'cache_preserved', true,
          'sqlstate', sqlstate
        )
      where id = v_job_id;

      return jsonb_build_object(
        'ok', false,
        'error', sqlerrm,
        'sqlstate', sqlstate,
        'cache_preserved', true
      );
  end;

  update public.system_job_logs
  set
    finished_at = clock_timestamp(),
    status = 'success',
    processed_count = v_rows,
    duration_ms = floor(
      extract(epoch from (clock_timestamp() - v_started_at)) * 1000
    )::bigint,
    error_message = null,
    details = jsonb_build_object(
      'aliases', v_aliases,
      'products', v_rows,
      'refreshed_at', v_refreshed_at
    )
  where id = v_job_id;

  return jsonb_build_object(
    'ok', true,
    'aliases', v_aliases,
    'products', v_rows,
    'refreshed_at', v_refreshed_at,
    'duration_ms', floor(
      extract(epoch from (clock_timestamp() - v_started_at)) * 1000
    )::bigint
  );
end;
$$;

revoke all on function public.refresh_article_product_cache() from public;
grant execute on function public.refresh_article_product_cache()
  to service_role;

-- Seed filters for the articles already imported before this migration.
select public.sync_honey_article_filters(
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
  and regexp_replace(a.url, '^.*/', '') ~
    '(^|-)(med|meda|mede|medom|medovyy|medovaya|medovom)(-|$)';

update public.article_product_filters
set enabled = false,
    updated_at = now()
where alias = 'honey-in-gift-baskets';

comment on function public.sync_honey_article_filters(jsonb) is
  'Upserts exact honey article filters, cluster navigation and published URLs.';
