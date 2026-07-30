-- service_role runs with safe-update protection in the admin Edge Function.
-- The cache key is NOT NULL, so this explicit predicate safely selects every
-- cache row while satisfying the protection against accidental broad deletes.

do $migration$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.refresh_article_product_cache()'::regprocedure
  )
  into v_definition;

  if lower(v_definition) ~
     'delete\s+from\s+public[.]article_product_cache\s+where\s+article_alias\s+is\s+not\s+null' then
    return;
  end if;

  v_patched := regexp_replace(
    v_definition,
    'delete\s+from\s+public[.]article_product_cache\s*;',
    'delete from public.article_product_cache where article_alias is not null;',
    'i'
  );

  if v_patched = v_definition then
    raise exception
      'Unable to locate article_product_cache delete in refresh function';
  end if;

  execute v_patched;
end;
$migration$;

comment on function public.refresh_article_product_cache() is
  'Safely rebuilds the article product cache under postgres and service_role.';
