-- Catalog compositions contain both misspelled forms `гранандила` and
-- `гранандилла`, plus the normative `гранадилла`. Preserve the published
-- article alias while recognizing every observed spelling.

do $do$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.sync_fruit_article_filters(jsonb)'::regprocedure
  ) into v_definition;

  v_definition := replace(
    v_definition,
    $needle$then 'гранадила'$needle$,
    $needle$then 'гранандил|гранадил'$needle$
  );

  if v_definition not like '%then ''гранандил|гранадил''%' then
    raise exception 'Unable to patch granadilla spellings';
  end if;

  execute v_definition;
end;
$do$;

update public.article_product_filters
set filter_value = 'гранандил|гранадил',
    updated_at = now()
where alias = 'granadilla-v-podarochnoy-korzine';
