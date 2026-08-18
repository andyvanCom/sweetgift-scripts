-- Allow product blocks to select real catalog categories in addition to
-- ingredient-based gift baskets. The new filter type is used only by the
-- secondary blocks of the teacher/school cluster and leaves existing filters
-- and the ingredient_excludes behavior unchanged.

alter table public.article_product_filters
  drop constraint if exists article_product_filters_filter_type;

alter table public.article_product_filters
  add constraint article_product_filters_filter_type
  check (
    filter_type in (
      'tag',
      'ingredient',
      'ingredient_contains',
      'ingredient_all_contains',
      'ingredient_excludes',
      'category_slug'
    )
  );

CREATE OR REPLACE FUNCTION public.refresh_article_product_cache()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ingredient_matched_products as materialized (
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
    excluded_products as materialized (
      select
        f.filter_key, f.filter_type, f.limit_count,
        p.product_key, p.price, p.title,
        100::integer as match_precision,
        '{}'::text[] as matched_ingredients
      from filter_definitions f
      join public.products_catalog p
        on p.available = true
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
      where f.filter_type = 'ingredient_excludes'
        and not exists (
          select 1
          from regexp_split_to_table(f.filter_value, '\s*\|\s*') as part(value)
          where nullif(trim(part.value), '') is not null
            and (
              position(lower(trim(part.value))
                in lower(concat_ws(' ', p.title, p.description, p.composition))) > 0
              or exists (
                select 1
                from public.product_ingredients pi
                where pi.product_key = p.product_key
                  and (
                    position(lower(trim(part.value))
                      in lower(coalesce(pi.ingredient_raw, ''))) > 0
                    or position(lower(trim(part.value))
                      in lower(coalesce(pi.ingredient_normalized, ''))) > 0
                  )
              )
            )
        )
    ),
    category_matched_products as materialized (
      select
        n.filter_key,
        n.filter_type,
        n.limit_count,
        p.product_key,
        p.price,
        p.title,
        100::integer as match_precision,
        '{}'::text[] as matched_ingredients
      from needles n
      join public.products_catalog p
        on lower(trim(coalesce(p.category_slug, ''))) = n.value
      where n.filter_type = 'category_slug'
        and p.available = true
      group by
        n.filter_key,
        n.filter_type,
        n.limit_count,
        p.product_key,
        p.price,
        p.title
    ),
    all_matched_products as materialized (
      select * from ingredient_matched_products
      union all
      select * from excluded_products
      union all
      select * from category_matched_products
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
        from all_matched_products m
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
      from all_matched_products m
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
$function$
;

revoke all on function public.refresh_article_product_cache() from public;
grant execute on function public.refresh_article_product_cache() to service_role;

update public.article_product_filters
set filter_type = 'category_slug',
    filter_value = 'klubnika-v-shokolade|bukety-iz-klubniki|bukety_iz_klubniki_i_tsvetov|frukty-v-shokolade|stakanchiki_s_klubnikoy|povod',
    title = 'Клубника в шоколаде и ягодные букеты',
    subtitle = 'Ещё один праздничный вариант для ученика, учителя или воспитателя',
    updated_at = now()
where alias like '%-additional'
  and cluster_key in (
    'teacher-school-teacher-additional',
    'teacher-school-child-additional',
    'teacher-school-flowers-additional',
    'teacher-school-women-additional',
    'teacher-school-budget-additional'
  );

