-- Keep product-card article links aligned with explicit New Year catalog
-- categories/titles. The existing article/product entity architecture is
-- preserved; this only supplies the missing product-side occasion entity.

create or replace function public.refresh_product_new_year_entities()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removed bigint := 0;
  v_upserted bigint := 0;
begin
  -- Remove a stale New Year marker when a product was renamed, moved out of
  -- the holiday category, or made unavailable.
  delete from public.product_seo_entities e
  where e.entity_type = 'occasion'
    and e.entity_value = 'новый год'
    and not exists (
      select 1
      from public.products_catalog p
      where p.product_key = e.product_key
        and p.available = true
        and lower(concat_ws(' ', p.category_slug, p.title, p.url)) ~
          'novogod|новогод|rozhdestv|рождеств'
    );

  -- A product explicitly living in a New Year category must not retain the
  -- generic birthday fallback as its occasion.
  delete from public.product_seo_entities e
  using public.products_catalog p
  where e.product_key = p.product_key
    and e.entity_type = 'occasion'
    and e.entity_value <> 'новый год'
    and p.available = true
    and lower(concat_ws(' ', p.category_slug, p.title, p.url)) ~
      'novogod|новогод|rozhdestv|рождеств';
  get diagnostics v_removed = row_count;

  insert into public.product_seo_entities (
    product_key, entity_type, entity_value, weight, updated_at
  )
  select
    p.product_key,
    'occasion',
    'новый год',
    140,
    now()
  from public.products_catalog p
  where p.available = true
    and lower(concat_ws(' ', p.category_slug, p.title, p.url)) ~
      'novogod|новогод|rozhdestv|рождеств'
  on conflict (product_key, entity_type, entity_value)
  do update set weight = excluded.weight, updated_at = excluded.updated_at;
  get diagnostics v_upserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'removed_other_occasions', v_removed,
    'new_year_entities', v_upserted
  );
end;
$$;

revoke all on function public.refresh_product_new_year_entities() from public;
grant execute on function public.refresh_product_new_year_entities()
  to service_role;

select public.refresh_product_new_year_entities();

comment on function public.refresh_product_new_year_entities() is
  'Assigns occasion=new year to available products explicitly marked by New Year catalog metadata.';
