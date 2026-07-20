-- Repair the article-import cron after key rotation without storing a secret in git.
-- The shared pipeline secret is copied from the already working classifier job.

do $$
declare
  v_pipeline_secret text;
begin
  select substring(command from '''x-report-secret'',''([^'']+)''')
  into v_pipeline_secret
  from cron.job
  where jobid = 15;

  if nullif(v_pipeline_secret, '') is null then
    raise exception 'Unable to read pipeline secret from classifier cron job';
  end if;

  perform cron.alter_job(
    6,
    command := format($command$
select net.http_get(
  url := 'https://rvgvbxipccbkytmhltmi.functions.supabase.co/import-articles-index?mode=daily&limit=100',
  headers := jsonb_build_object(
    'x-report-secret', %L,
    'Content-Type', 'application/json'
  )
);
$command$, v_pipeline_secret)
  );
end;
$$;

-- Close abandoned log rows so monitoring does not report them as current runs forever.
update public.system_job_logs
set status = 'error',
    finished_at = coalesce(finished_at, started_at + interval '2 hours'),
    duration_ms = coalesce(duration_ms, 7200000),
    error_message = coalesce(error_message, 'Run was interrupted before completion')
where status = 'running'
  and started_at < now() - interval '2 hours';
