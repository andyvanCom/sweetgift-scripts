-- The SMTP client used by the report function currently needs the legacy
-- Deno runtime. Keep the nightly invocation on Deno 1 while the mail
-- dependency is migrated, without exposing or rewriting the cron secret.
do $block$
declare
  v_job_id bigint;
  v_command text;
  v_patched_command text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron extension is not installed';
  end if;

  select jobid, command
  into v_job_id, v_command
  from cron.job
  where jobname = 'send-daily-report';

  if v_job_id is null then
    raise exception 'Cron job send-daily-report is missing';
  end if;

  if v_command like '%forceDenoVersion=1%' then
    return;
  end if;

  v_patched_command := replace(
    v_command,
    '/send-daily-report''',
    '/send-daily-report?forceDenoVersion=1'''
  );

  if v_patched_command = v_command then
    raise exception 'Unable to patch send-daily-report cron URL';
  end if;

  perform cron.alter_job(v_job_id, command := v_patched_command);
end;
$block$;
