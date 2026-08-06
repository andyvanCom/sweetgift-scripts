-- The generic `чай` keyword previously matched the ending of `вручайте`.
-- Remove only that false tea classification while preserving the source text.

begin;

with false_tea_rows as (
  select pi.id
  from public.product_ingredients pi
  where lower(coalesce(pi.tag, '')) = 'tea'
    and lower(trim(coalesce(pi.ingredient_normalized, ''))) =
      'если нет возможности обеспечить холод, вручайте подарок сразу после получения.'
    and exists (
      select 1
      from public.product_ingredients sibling
      where sibling.product_key = pi.product_key
        and sibling.id <> pi.id
        and sibling.ingredient_raw is not distinct from pi.ingredient_raw
        and lower(coalesce(sibling.tag, '')) <> 'tea'
    )
)
delete from public.product_ingredients pi
using false_tea_rows false_row
where pi.id = false_row.id;

update public.product_ingredients pi
set tag = null
where lower(coalesce(pi.tag, '')) = 'tea'
  and lower(trim(coalesce(pi.ingredient_normalized, ''))) =
    'если нет возможности обеспечить холод, вручайте подарок сразу после получения.';

commit;

