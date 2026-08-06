-- The full article-product cache now takes longer than the project-wide
-- statement timeout. Keep the existing daily schedule, but give this one
-- maintenance job the same bounded timeout as the manual admin refresh.
do $$
declare
  v_job_id bigint;
begin
  if not exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    raise exception 'pg_cron extension is not installed';
  end if;

  select jobid
  into v_job_id
  from cron.job
  where jobname = 'refresh-article-product-cache-daily'
  order by jobid desc
  limit 1;

  if v_job_id is null then
    raise exception 'Cron job refresh-article-product-cache-daily is missing';
  end if;

  perform cron.alter_job(
    v_job_id,
    command := $command$
set statement_timeout = '10min';
select public.refresh_article_product_cache();
$command$
  );
end;
$$;

