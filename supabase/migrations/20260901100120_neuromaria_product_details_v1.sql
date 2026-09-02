create or replace function public.neuromaria_product_details_v1(product_reference text)
returns jsonb
language sql
stable
security definer
set search_path to public, pg_temp
set statement_timeout to '3s'
as $function$
  with target as (
    select p.*
    from public.products_catalog p
    where length(trim(product_reference)) between 3 and 500
      and (
        p.product_key = trim(product_reference)
        or p.url = trim(product_reference)
        or lower(p.title) = lower(trim(product_reference))
        or exists (
          select 1 from public.product_variants v
          where v.product_key = p.product_key
            and v.variant_key = trim(product_reference)
        )
      )
    order by
      case
        when p.product_key = trim(product_reference) then 0
        when p.url = trim(product_reference) then 1
        else 2
      end,
      p.updated_at desc
    limit 1
  ), prepared as (
    select t.*,
      nullif(regexp_replace(coalesce(t.raw->>'weight',''), '[^0-9.,]+', '', 'g'), '') as weight_text,
      regexp_split_to_array(coalesce(t.raw->>'dimensions',''), '\s*/\s*') as dimension_parts
    from target t
  )
  select jsonb_build_object(
    'product_key', p.product_key,
    'title', p.title,
    'url', p.url,
    'price', p.price,
    'available', p.available,
    'description', p.description,
    'composition', p.composition,
    'weight_kg', case when p.weight_text ~ '^[0-9]+([.,][0-9]+)?$' then replace(p.weight_text, ',', '.')::numeric end,
    'dimensions', jsonb_build_object(
      'length', case when p.dimension_parts[1] ~ '^[0-9]+([.,][0-9]+)?$' then replace(p.dimension_parts[1], ',', '.')::numeric end,
      'width', case when p.dimension_parts[2] ~ '^[0-9]+([.,][0-9]+)?$' then replace(p.dimension_parts[2], ',', '.')::numeric end,
      'height', case when p.dimension_parts[3] ~ '^[0-9]+([.,][0-9]+)?$' then replace(p.dimension_parts[3], ',', '.')::numeric end
    ),
    'ingredients', coalesce((
      select jsonb_agg(i.name order by i.name)
      from (
        select distinct coalesce(nullif(trim(pi.ingredient_raw),''), nullif(trim(pi.ingredient_normalized),'')) as name
        from public.product_ingredients pi
        where pi.product_key = p.product_key
      ) i
      where i.name is not null
    ), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'variant_key', v.variant_key,
        'title', v.title,
        'option_value', v.option_value,
        'price', v.price,
        'available', v.available
      ) order by v.price nulls last, v.title)
      from public.product_variants v
      where v.product_key = p.product_key
    ), '[]'::jsonb)
  )
  from prepared p;
$function$;

revoke all on function public.neuromaria_product_details_v1(text) from public;
grant execute on function public.neuromaria_product_details_v1(text)
  to anon, authenticated, service_role;

comment on function public.neuromaria_product_details_v1(text) is
  'Read-only, bounded public product facts for NeuroMaria text and Vapi voice transports.';
