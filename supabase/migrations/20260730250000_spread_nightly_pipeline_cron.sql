-- Give each nightly pipeline stage enough time to finish before the next one
-- starts. Commands, credentials and enabled states remain unchanged.
do $$
declare
  v_missing text[];
begin
  if not exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    raise exception 'pg_cron extension is not installed';
  end if;

  with wanted(jobname) as (
    values
      ('import-yml-products-daily'::text),
      ('import-articles-index-daily'::text),
      ('classify-articles-daily'::text),
      ('refresh-article-product-cache-daily'::text),
      ('refresh-product-card-seo-blocks-daily'::text),
      ('refresh-article-product-recommendations-daily'::text),
      ('send-daily-report'::text)
  )
  select array_agg(w.jobname order by w.jobname)
  into v_missing
  from wanted w
  left join cron.job j on j.jobname = w.jobname
  where j.jobid is null;

  if v_missing is not null then
    raise exception 'Missing nightly cron jobs: %', v_missing;
  end if;

  perform cron.alter_job(
    (select jobid from cron.job where jobname = 'import-yml-products-daily'),
    schedule := '0 4 * * *'
  );

  perform cron.alter_job(
    (select jobid from cron.job where jobname = 'import-articles-index-daily'),
    schedule := '30 4 * * *'
  );

  perform cron.alter_job(
    (select jobid from cron.job where jobname = 'classify-articles-daily'),
    schedule := '45 4 * * *'
  );

  perform cron.alter_job(
    (
      select jobid
      from cron.job
      where jobname = 'refresh-article-product-cache-daily'
    ),
    schedule := '0 5 * * *'
  );

  perform cron.alter_job(
    (
      select jobid
      from cron.job
      where jobname = 'refresh-product-card-seo-blocks-daily'
    ),
    schedule := '15 5 * * *'
  );

  perform cron.alter_job(
    (
      select jobid
      from cron.job
      where jobname = 'refresh-article-product-recommendations-daily'
    ),
    schedule := '30 5 * * *'
  );

  perform cron.alter_job(
    (select jobid from cron.job where jobname = 'send-daily-report'),
    schedule := '45 5 * * *'
  );
end;
$$;
