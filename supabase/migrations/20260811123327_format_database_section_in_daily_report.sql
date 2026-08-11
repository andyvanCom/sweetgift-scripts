-- The existing report body historically uses readable \n markers in its SQL
-- source. Convert them to real line breaks before returning the report.
do $block$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(p.oid)
  into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_daily_report_text'
    and pg_get_function_identity_arguments(p.oid) = '';

  if v_definition is null then
    raise exception 'public.get_daily_report_text() is missing';
  end if;

  v_patched := replace(
    v_definition,
    'return v_text;',
    $$return replace(v_text, chr(92) || 'n', chr(10));$$
  );

  if v_patched = v_definition then
    raise exception 'Unable to patch public.get_daily_report_text() return statement';
  end if;

  execute v_patched;
end;
$block$;
