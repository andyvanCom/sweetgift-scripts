-- The article catalog now needs more than the project-wide two-minute
-- statement timeout for a complete safe cache rebuild. Keep the public admin
-- action asynchronous, but give only its pg_cron worker a bounded 10 minutes.

create or replace function public.request_article_product_cache_refresh()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job_name constant text := 'refresh-article-product-cache-manual';
  v_existing_job_id bigint;
  v_job_id bigint;
  v_started_at timestamptz;
begin
  if not exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'pg_cron extension is not installed'
    );
  end if;

  select l.started_at
  into v_started_at
  from public.system_job_logs l
  where l.job_name = 'refresh-article-product-cache'
    and l.status = 'running'
    and l.started_at > now() - interval '30 minutes'
  order by l.id desc
  limit 1;

  if v_started_at is not null then
    return jsonb_build_object(
      'ok', true,
      'queued', false,
      'status', 'running',
      'started_at', v_started_at
    );
  end if;

  select j.jobid
  into v_existing_job_id
  from cron.job j
  where j.jobname = v_job_name
  order by j.jobid desc
  limit 1;

  if v_existing_job_id is not null then
    return jsonb_build_object(
      'ok', true,
      'queued', true,
      'status', 'queued',
      'job_id', v_existing_job_id
    );
  end if;

  select cron.schedule(
    v_job_name,
    '* * * * *',
    $command$
set statement_timeout = '10min';
do $job$
declare
  v_own_job_id bigint;
begin
  select jobid
  into v_own_job_id
  from cron.job
  where jobname = 'refresh-article-product-cache-manual'
  order by jobid desc
  limit 1;

  if v_own_job_id is not null then
    perform cron.unschedule(v_own_job_id);
  end if;

  perform public.refresh_article_product_cache();
end;
$job$;
$command$
  )
  into v_job_id;

  return jsonb_build_object(
    'ok', true,
    'queued', true,
    'status', 'queued',
    'job_id', v_job_id,
    'scheduled_for', date_trunc('minute', now()) + interval '1 minute'
  );
end;
$function$;

revoke all on function public.request_article_product_cache_refresh()
  from public, anon, authenticated;
grant execute on function public.request_article_product_cache_refresh()
  to service_role;

comment on function public.request_article_product_cache_refresh() is
  'Queues a self-removing cache rebuild with a bounded 10-minute cron timeout.';
