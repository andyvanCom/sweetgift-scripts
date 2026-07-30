-- Precompute exact article Alias -> product bindings at night.
--
-- The public RPC keeps its existing name, argument and JSON contract. Cache
-- replacement happens in a PL/pgSQL subtransaction: if calculation or insert
-- fails, PostgreSQL rolls back the delete and the previous cache stays live.

create table if not exists public.article_product_cache (
  article_alias text not null,
  product_key text not null,
  rank integer not null,
  match_precision integer not null default 0,
  popularity_score bigint not null default 0,
  matched_ingredients text[] not null default '{}'::text[],
  refreshed_at timestamptz not null,
  primary key (article_alias, product_key),
  unique (article_alias, rank),
  constraint article_product_cache_rank_positive check (rank > 0)
);

create index if not exists article_product_cache_product_key_idx
  on public.article_product_cache (product_key);

create index if not exists article_product_cache_refreshed_at_idx
  on public.article_product_cache (refreshed_at desc);

alter table public.article_product_cache enable row level security;

revoke all on table public.article_product_cache from public, anon, authenticated;
grant all on table public.article_product_cache to service_role;

comment on table public.article_product_cache is
  'Nightly precomputed products for exact article_product_filters aliases.';

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
  -- Serialize manual, post-import and cron refreshes. Readers are never
  -- blocked because they continue to see the previous committed cache.
  perform pg_advisory_xact_lock(7339471381);

  insert into public.system_job_logs (
    job_name,
    started_at,
    status
  )
  values (
    'refresh-article-product-cache',
    v_started_at,
    'running'
  )
  returning id into v_job_id;

  begin
    delete from public.article_product_cache;

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
    needles as materialized (
      select
        f.alias,
        f.filter_type,
        f.limit_count,
        lower(trim(part.value)) as value
      from public.article_product_filters f
      cross join lateral regexp_split_to_table(
        f.filter_value,
        '\s*\|\s*'
      ) as part(value)
      where f.enabled = true
        and nullif(trim(part.value), '') is not null
    ),
    matched_products as materialized (
      select
        n.alias as article_alias,
        n.limit_count,
        p.product_key,
        p.price,
        p.title,
        max(
          case
            when n.filter_type = 'ingredient_contains'
                 and lower(trim(coalesce(pi.ingredient_raw, ''))) = n.value
              then 100
            when n.filter_type = 'ingredient_contains'
                 and position(
                   n.value in lower(coalesce(pi.ingredient_raw, ''))
                 ) = 1
              then 90
            when n.filter_type = 'ingredient_contains' then 80
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
          n.filter_type = 'ingredient_contains'
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
        n.alias,
        n.limit_count,
        p.product_key,
        p.price,
        p.title
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
        m.article_alias,
        m.product_key,
        row_number() over (
          partition by m.article_alias
          order by
            case
              when f.filter_type = 'tag' then 0
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
      join public.article_product_filters f on f.alias = m.article_alias
      left join popularity pop on pop.product_key = m.product_key
    )
    select
      r.article_alias,
      r.product_key,
      r.rank,
      r.match_precision,
      r.popularity_score,
      r.matched_ingredients,
      v_refreshed_at
    from ranked r
    where r.rank <= r.limit_count;

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
grant execute on function public.refresh_article_product_cache() to service_role;

create or replace function public.get_article_product_cache_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'active_filters', (
      select count(*)
      from public.article_product_filters
      where enabled = true
    ),
    'cached_aliases', count(distinct c.article_alias),
    'cached_products', count(*),
    'refreshed_at', max(c.refreshed_at)
  )
  from public.article_product_cache c;
$$;

revoke all on function public.get_article_product_cache_status()
  from public, anon, authenticated;
grant execute on function public.get_article_product_cache_status()
  to service_role;

create or replace function public.get_article_products(article_alias text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rule public.article_product_filters%rowtype;
  v_result jsonb;
begin
  if article_alias is null
     or length(article_alias) > 200
     or article_alias !~ '^[a-z0-9][a-z0-9-]*$' then
    return null;
  end if;

  select *
  into v_rule
  from public.article_product_filters
  where alias = article_alias
    and enabled = true;

  if not found then
    return null;
  end if;

  with navigation as (
    select
      f.alias,
      f.title,
      f.cluster_order
    from public.article_product_filters f
    where f.enabled = true
      and f.cluster_key = v_rule.cluster_key
      and f.alias <> v_rule.alias
    order by f.cluster_order, f.title
  )
  select jsonb_build_object(
    'alias', v_rule.alias,
    'title', v_rule.title,
    'subtitle', v_rule.subtitle,
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_key', p.product_key,
          'title', p.title,
          'url', p.url,
          'price', p.price,
          'image', p.image,
          'composition', p.composition,
          'matched_ingredients', c.matched_ingredients,
          'popularity', c.popularity_score
        )
        order by c.rank
      )
      from public.article_product_cache c
      join public.products_catalog p on p.product_key = c.product_key
      where c.article_alias = v_rule.alias
        and p.available = true
    ), '[]'::jsonb),
    'navigation', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'alias', n.alias,
          'title',
            case
              when n.alias = 'podarochnye-korziny-s-syrom'
                then 'Все материалы о сырах в подарочных корзинах'
              else n.title
            end,
          'url', '/stati/' || n.alias
        )
        order by n.cluster_order, n.title
      )
      from navigation n
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_article_products(text) is
  'Returns precomputed available products and cluster navigation for one article Alias.';

revoke all on function public.get_article_products(text) from public;
grant execute on function public.get_article_products(text) to anon, authenticated;

create or replace function public.get_system_pipeline_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with expected(job_name) as (
    values
      ('import-yml-products'::text),
      ('import-articles-index'::text),
      ('classify-articles'::text),
      ('refresh-article-product-cache'::text),
      ('send-daily-report'::text)
  ),
  latest as (
    select distinct on (l.job_name)
      l.job_name,
      l.started_at,
      l.finished_at,
      l.status,
      l.processed_count,
      l.duration_ms,
      l.error_message,
      l.details
    from public.system_job_logs l
    join expected e on e.job_name = l.job_name
    order by l.job_name, l.started_at desc
  )
  select jsonb_build_object(
    'generated_at', now(),
    'jobs', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'job_name', e.job_name,
          'started_at', l.started_at,
          'finished_at', l.finished_at,
          'status', coalesce(l.status, 'never'),
          'processed_count', coalesce(l.processed_count, 0),
          'duration_ms', l.duration_ms,
          'error_message', l.error_message,
          'details', coalesce(l.details, '{}'::jsonb),
          'fresh', coalesce(l.finished_at, l.started_at) >=
            now() - interval '30 hours'
        )
        order by e.job_name
      ),
      '[]'::jsonb
    )
  )
  from expected e
  left join latest l on l.job_name = e.job_name;
$$;

revoke all on function public.get_system_pipeline_health()
  from public, anon, authenticated;
grant execute on function public.get_system_pipeline_health() to service_role;

do $$
declare
  v_existing_job_id bigint;
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    select jobid
    into v_existing_job_id
    from cron.job
    where jobname = 'refresh-article-product-cache-daily'
    order by jobid desc
    limit 1;

    if v_existing_job_id is not null then
      perform cron.unschedule(v_existing_job_id);
    end if;

    perform cron.schedule(
      'refresh-article-product-cache-daily',
      '48 4 * * *',
      'select public.refresh_article_product_cache();'
    );
  end if;
end;
$$;

do $$
declare
  v_result jsonb;
begin
  v_result := public.refresh_article_product_cache();

  if not coalesce((v_result ->> 'ok')::boolean, false) then
    raise exception 'Initial article product cache refresh failed: %', v_result;
  end if;
end;
$$;
