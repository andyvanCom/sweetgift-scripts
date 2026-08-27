-- Keep the existing selector implementation and add the shared catalog-section
-- policy at its single `available_products` source CTE. This also makes the
-- ingredient counts reflect only products that can actually be displayed.

do $migration$
declare
  v_definition text;
  v_search text := 'where p.available = true';
  v_replacement text :=
    'where p.available = true' || E'\n' ||
    '      and public.is_article_product_section_allowed(p.category_slug, p.url)';
begin
  select pg_get_functiondef(
    'public.get_gift_selector_catalog_for(text)'::regprocedure
  )
  into v_definition;

  if position(v_search in v_definition) = 0 then
    raise exception
      'Unable to locate available_products predicate in get_gift_selector_catalog_for(text)';
  end if;

  execute replace(v_definition, v_search, v_replacement);
end;
$migration$;

comment on function public.get_gift_selector_catalog_for(text) is
  'Returns basket/box composition-selector data; products from prohibited alcohol-specific catalog sections are excluded.';
