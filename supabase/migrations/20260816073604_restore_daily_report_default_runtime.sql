-- The diagnostic Deno 1 pin did not affect the Yandex SMTP 525 response.
-- Restore the normal Edge runtime after identifying the external mail-account
-- restriction as the actual failure.
do $block$
declare
  v_job_id bigint;
  v_command text;
  v_patched_command text;
begin
  select jobid, command
  into v_job_id, v_command
  from cron.job
  where jobname = 'send-daily-report';

  if v_job_id is null then
    raise exception 'Cron job send-daily-report is missing';
  end if;

  v_patched_command := replace(
    v_command,
    '/send-daily-report?forceDenoVersion=1''',
    '/send-daily-report'''
  );

  if v_patched_command <> v_command then
    perform cron.alter_job(v_job_id, command := v_patched_command);
  end if;
end;
$block$;
