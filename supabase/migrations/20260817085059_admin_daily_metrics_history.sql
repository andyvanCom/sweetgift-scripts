create table if not exists public.admin_daily_metrics (
  snapshot_date date primary key,
  captured_at timestamptz not null default now(),
  products_available integer not null default 0 check (products_available >= 0),
  articles_active integer not null default 0 check (articles_active >= 0),
  articles_total integer not null default 0 check (articles_total >= 0),
  articles_unclassified integer not null default 0 check (articles_unclassified >= 0),
  article_views_total bigint not null default 0 check (article_views_total >= 0),
  article_views_yesterday bigint not null default 0 check (article_views_yesterday >= 0),
  orders_yesterday integer not null default 0 check (orders_yesterday >= 0),
  product_events_yesterday bigint not null default 0 check (product_events_yesterday >= 0),
  database_bytes bigint not null default 0 check (database_bytes >= 0)
);

comment on table public.admin_daily_metrics is
  'One aggregate admin snapshot per day, retained for 90 days. Contains no personal or article content data.';
alter table public.admin_daily_metrics enable row level security;
revoke all on table public.admin_daily_metrics from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_daily_metrics to service_role;

create or replace function public.capture_admin_daily_metrics(retention_days integer default 90)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_deleted integer := 0; v_row_bytes integer := 0;
begin
  if retention_days < 7 or retention_days > 366 then
    raise exception 'retention_days must be between 7 and 366';
  end if;
  if not pg_try_advisory_xact_lock(hashtext('sweetgift-admin-daily-metrics')) then
    return jsonb_build_object('status','skipped','reason','already_running');
  end if;
  insert into public.admin_daily_metrics (
    snapshot_date,captured_at,products_available,articles_active,articles_total,
    articles_unclassified,article_views_total,article_views_yesterday,
    orders_yesterday,product_events_yesterday,database_bytes
  ) values (
    current_date,now(),
    (select count(*) from public.products_catalog where available=true),
    (select count(*) from public.articles_index where is_active=true),
    (select count(*) from public.articles_index),
    (select count(*) from public.articles_index where seo_topic_title is null),
    (select coalesce(sum(views),0) from public.article_views),
    (select coalesce(sum(views),0) from public.article_views_daily where view_date=current_date-1),
    (select count(distinct order_id) from public.product_orders where created_at>=current_date-interval '1 day' and created_at<current_date),
    (select count(*) from public.product_events where created_at>=current_date-interval '1 day' and created_at<current_date),
    pg_database_size(current_database())
  ) on conflict (snapshot_date) do update set
    captured_at=excluded.captured_at,products_available=excluded.products_available,
    articles_active=excluded.articles_active,articles_total=excluded.articles_total,
    articles_unclassified=excluded.articles_unclassified,article_views_total=excluded.article_views_total,
    article_views_yesterday=excluded.article_views_yesterday,orders_yesterday=excluded.orders_yesterday,
    product_events_yesterday=excluded.product_events_yesterday,database_bytes=excluded.database_bytes;
  delete from public.admin_daily_metrics where snapshot_date < current_date-(retention_days-1);
  get diagnostics v_deleted = row_count;
  select pg_column_size(m) into v_row_bytes from public.admin_daily_metrics m where snapshot_date=current_date;
  return jsonb_build_object('status','success','snapshot_date',current_date,'retention_days',retention_days,'deleted_rows',v_deleted,'estimated_row_bytes',coalesce(v_row_bytes,0));
end;
$function$;

revoke all on function public.capture_admin_daily_metrics(integer) from public, anon, authenticated;
grant execute on function public.capture_admin_daily_metrics(integer) to service_role;

do $block$
declare v_existing_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname='pg_cron') then raise exception 'pg_cron extension is not installed'; end if;
  select jobid into v_existing_job_id from cron.job where jobname='capture-admin-daily-metrics';
  if v_existing_job_id is not null then perform cron.unschedule(v_existing_job_id); end if;
  perform cron.schedule('capture-admin-daily-metrics','50 5 * * *',$cron$select public.capture_admin_daily_metrics(90);$cron$);
end;
$block$;

select public.capture_admin_daily_metrics(90);
