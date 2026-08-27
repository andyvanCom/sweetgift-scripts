-- Keep the product-card "Похожие композиции" block under the same catalog
-- section policy as article product recommendations.

create or replace function public.filter_allowed_product_items(items jsonb)
returns jsonb
language sql
stable
set search_path = public
as $function$
  select coalesce(jsonb_agg(entry.item order by entry.ordinality), '[]'::jsonb)
  from jsonb_array_elements(coalesce(items, '[]'::jsonb))
    with ordinality as entry(item, ordinality)
  where public.is_article_product_section_allowed(null, entry.item ->> 'url');
$function$;

revoke all on function public.filter_allowed_product_items(jsonb)
  from public, anon, authenticated;
grant execute on function public.filter_allowed_product_items(jsonb)
  to service_role;

create or replace function public.guard_product_card_product_blocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  new.similar_products := public.filter_allowed_product_items(
    new.similar_products
  );

  select coalesce(
    jsonb_agg(
      case
        when block.item ->> 'type' = 'products'
          then jsonb_set(
            block.item,
            '{items}',
            public.filter_allowed_product_items(block.item -> 'items'),
            true
          )
        else block.item
      end
      order by block.ordinality
    ),
    '[]'::jsonb
  )
  into new.blocks
  from jsonb_array_elements(coalesce(new.blocks, '[]'::jsonb))
    with ordinality as block(item, ordinality);

  return new;
end;
$function$;

revoke all on function public.guard_product_card_product_blocks()
  from public, anon, authenticated;

drop trigger if exists guard_product_card_product_blocks
  on public.product_card_seo_blocks;
create trigger guard_product_card_product_blocks
before insert or update of similar_products, blocks
on public.product_card_seo_blocks
for each row execute function public.guard_product_card_product_blocks();

-- Clean already materialized blocks. The trigger applies the same policy to
-- both the dedicated column and the mirrored products block in `blocks`.
update public.product_card_seo_blocks
set
  similar_products = similar_products,
  blocks = blocks,
  updated_at = now();

comment on function public.filter_allowed_product_items(jsonb) is
  'Removes products from prohibited alcohol-specific catalog sections from JSON product lists while preserving item order.';
