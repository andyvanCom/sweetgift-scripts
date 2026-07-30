-- Remove false `cheese` tags produced by the generic `сыр` keyword matching
-- `сырокопченый` and `сыровяленый`.
--
-- Preserve rows that contain a later real cheese occurrence, for example
-- `колбаса сырокопченая с сыром дорблю`.
-- If the same ingredient already has another tag, remove only its duplicate
-- `cheese` row. Otherwise keep the ingredient and reset its tag to NULL.

begin;

with false_cheese_rows as (
  select pi.id
  from public.product_ingredients pi
  where lower(coalesce(pi.tag, '')) = 'cheese'
    and lower(coalesce(pi.ingredient_normalized, '')) ~ 'сырокоп|сыровял'
    and lower(coalesce(pi.ingredient_normalized, '')) !~ 'сыр(?!окоп|овял)'
    and not exists (
      select 1
      from public.ingredient_tag_rules cheese_rule
      where cheese_rule.enabled = true
        and lower(cheese_rule.tag) = 'cheese'
        and lower(cheese_rule.keyword) <> 'сыр'
        and lower(coalesce(pi.ingredient_normalized, ''))
            like '%' || lower(cheese_rule.keyword) || '%'
    )
    and exists (
      select 1
      from public.product_ingredients sibling
      where sibling.product_key = pi.product_key
        and sibling.id <> pi.id
        and sibling.ingredient_raw is not distinct from pi.ingredient_raw
        and lower(coalesce(sibling.tag, '')) <> 'cheese'
    )
)
delete from public.product_ingredients pi
using false_cheese_rows false_row
where pi.id = false_row.id;

update public.product_ingredients pi
set tag = null
where lower(coalesce(pi.tag, '')) = 'cheese'
  and lower(coalesce(pi.ingredient_normalized, '')) ~ 'сырокоп|сыровял'
  and lower(coalesce(pi.ingredient_normalized, '')) !~ 'сыр(?!окоп|овял)'
  and not exists (
    select 1
    from public.ingredient_tag_rules cheese_rule
    where cheese_rule.enabled = true
      and lower(cheese_rule.tag) = 'cheese'
      and lower(cheese_rule.keyword) <> 'сыр'
      and lower(coalesce(pi.ingredient_normalized, ''))
          like '%' || lower(cheese_rule.keyword) || '%'
  );

commit;
