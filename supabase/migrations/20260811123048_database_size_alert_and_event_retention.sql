-- Keep detailed product analytics for 180 days, then retain daily aggregates.
-- Also expose database usage in the existing daily report with a warning at
-- 350 MiB, comfortably before the 500 MiB Free-plan database limit.

create table if not exists public.product_events_daily (
  event_date date not null,
  product_key text not null,
  event_type text not null,
  category_slug text not null default '',
  source text not null default '',
  channel text not null default '',
  event_count bigint not null default 0 check (event_count >= 0),
  first_event_at timestamptz not null,
  last_event_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (
    event_date,
    product_key,
    event_type,
    category_slug,
    source,
    channel
  )
);

comment on table public.product_events_daily is
  'Daily product event aggregates retained after detailed product_events rows expire at 180 days.';

create index if not exists product_events_daily_product_date_idx
  on public.product_events_daily (product_key, event_date desc);

create index if not exists product_events_daily_type_date_idx
  on public.product_events_daily (event_type, event_date desc);

alter table public.product_events_daily enable row level security;
revoke all on table public.product_events_daily from anon, authenticated;

create or replace function public.archive_old_product_events(
  retention_days integer default 180
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_cutoff timestamptz;
  v_archived bigint := 0;
  v_deleted bigint := 0;
begin
  if retention_days < 30 then
    raise exception 'retention_days must be at least 30';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('sweetgift-product-events-retention')) then
    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'already_running',
      'retention_days', retention_days
    );
  end if;

  v_cutoff := now() - make_interval(days => retention_days);

  select count(*) into v_archived
  from public.product_events
  where created_at < v_cutoff;

  with old_events as materialized (
    select
      created_at::date as event_date,
      product_key,
      event_type,
      coalesce(category_slug, '') as category_slug,
      coalesce(source, '') as source,
      coalesce(channel, '') as channel,
      count(*)::bigint as event_count,
      min(created_at) as first_event_at,
      max(created_at) as last_event_at
    from public.product_events
    where created_at < v_cutoff
    group by 1, 2, 3, 4, 5, 6
  )
  insert into public.product_events_daily (
      event_date,
      product_key,
      event_type,
      category_slug,
      source,
      channel,
      event_count,
      first_event_at,
      last_event_at,
      updated_at
    )
    select
      event_date,
      product_key,
      event_type,
      category_slug,
      source,
      channel,
      event_count,
      first_event_at,
      last_event_at,
      now()
    from old_events
    on conflict (
      event_date,
      product_key,
      event_type,
      category_slug,
      source,
      channel
    ) do update set
      event_count = public.product_events_daily.event_count + excluded.event_count,
      first_event_at = least(public.product_events_daily.first_event_at, excluded.first_event_at),
      last_event_at = greatest(public.product_events_daily.last_event_at, excluded.last_event_at),
      updated_at = now()
  ;

  delete from public.product_events
  where created_at < v_cutoff;
  get diagnostics v_deleted = row_count;

  if v_archived <> v_deleted then
    raise exception 'Archive verification failed: aggregated %, deleted %',
      v_archived, v_deleted;
  end if;

  return jsonb_build_object(
    'status', 'success',
    'retention_days', retention_days,
    'cutoff', v_cutoff,
    'archived_events', v_archived,
    'deleted_rows', v_deleted
  );
end;
$function$;

comment on function public.archive_old_product_events(integer) is
  'Aggregates and deletes detailed product events older than the requested retention period.';

revoke all on function public.archive_old_product_events(integer) from public, anon, authenticated;

do $block$
declare
  v_existing_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron extension is not installed';
  end if;

  select jobid into v_existing_job_id
  from cron.job
  where jobname = 'archive-product-events-daily';

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'archive-product-events-daily',
    '35 5 * * *',
    $cron$select public.archive_old_product_events(180);$cron$
  );
end;
$block$;

create or replace function public.get_daily_report_text()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_text text;
  v_database_bytes bigint := pg_database_size(current_database());
  v_database_mb numeric := round(v_database_bytes / 1024.0 / 1024.0, 1);
  v_database_warning text;
begin
  v_database_warning := case
    when v_database_bytes >= 350::bigint * 1024 * 1024 then
      E'\n⚠️ ВНИМАНИЕ: размер базы превысил 350 МБ. Необходимо проверить рост и очистку данных.'
    else ''
  end;

  select
'Доброе утро!\n\nНочная обработка SweetGift завершена.\n\n📦 ТОВАРЫ\nВсего товаров: ' || (select count(*) from public.products_catalog) || '\nДоступных товаров: ' || (select count(*) from public.products_catalog where available = true) || '\n\n📰 СТАТЬИ\nВсего статей: ' || (select count(*) from public.articles_index) || '\nСтатей без SEO-темы: ' || (select count(*) from public.articles_index where seo_topic_title is null) || '\n\n🔗 ПЕРЕЛИНКОВКА\nКарточек с SEO-блоками: ' || (select count(*) from public.product_card_seo_blocks) || '\nТоваров без SEO-блоков: ' || (
  select count(*)
  from public.products_catalog pc
  left join public.product_card_seo_blocks b on b.product_key = pc.product_key
  where pc.available = true and b.product_key is null
) || '\n\n🏷 СУЩНОСТИ\nСущностей статей: ' || (select count(*) from public.article_seo_entities) || '\nСущностей товаров: ' || (select count(*) from public.product_seo_entities) || '\n\n📈 АНАЛИТИКА\nПросмотров товаров вчера: ' || (
  select count(*)
  from public.product_events
  where created_at >= current_date - interval '1 day'
    and created_at < current_date
) || '\nПросмотров статей всего: ' || (select coalesce(sum(views),0) from public.article_views) || '\n\n🛒 ЗАКАЗЫ\nЗаказов вчера: ' || (
  select count(distinct order_id)
  from public.product_orders
  where created_at >= current_date - interval '1 day'
    and created_at < current_date
) || '\n\n💾 БАЗА ДАННЫХ\nРазмер базы: ' || v_database_mb || ' МБ из 500 МБ (' || round(v_database_bytes * 100.0 / (500::bigint * 1024 * 1024), 1) || '%)\nПодробные события: 180 дней, более старые — агрегировано' || v_database_warning || '\n\n⚠️ ТРЕБУЕТ ВНИМАНИЯ\nСтатей без сущностей: ' || (
  select count(*)
  from public.articles_index ai
  left join public.article_seo_entities e on e.article_key = ai.article_key
  where e.article_key is null
) || '\nТоваров без сущностей: ' || (
  select count(*)
  from public.products_catalog pc
  left join public.product_seo_entities e on e.product_key = pc.product_key
  where pc.available = true and e.product_key is null
) || '\n\nОтчет сформирован: ' || now()::text
  into v_text;

  return replace(v_text, chr(92) || 'n', chr(10));
end;
$function$;

revoke all on function public.get_daily_report_text() from public, anon, authenticated;
grant execute on function public.get_daily_report_text() to service_role;
