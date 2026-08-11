-- Add the missing structured nut tag used by the gift selector.
-- Keep the Russian value intentionally: get_gift_selector_catalog_for()
-- passes unknown tags through unchanged, so the public chip is immediately
-- displayed as "орехи" without changing the existing RPC contract.

with desired(keyword, priority) as (
  values
    ('орех', 8),
    ('миндал', 8),
    ('фундук', 8),
    ('кешью', 8),
    ('пекан', 8),
    ('фисташ', 8),
    ('арахис', 8),
    ('макадам', 8),
    ('кокос', 8)
)
insert into public.ingredient_tag_rules (tag, keyword, priority, enabled)
select 'орехи', d.keyword, d.priority, true
from desired d
where not exists (
  select 1
  from public.ingredient_tag_rules r
  where lower(trim(r.tag)) = 'орехи'
    and lower(trim(r.keyword)) = d.keyword
);
-- Backfill already imported products. A composition line may already have a
-- different tag, therefore insert a separate nut-tag row instead of replacing
-- the existing classification.
with nut_source as (
  select distinct on (
    pi.product_key,
    pi.ingredient_raw,
    pi.ingredient_normalized,
    pi.weight_text
  )
    pi.product_key,
    pi.ingredient_raw,
    pi.ingredient_normalized,
    pi.weight_text
  from public.product_ingredients pi
  where lower(coalesce(pi.ingredient_normalized, pi.ingredient_raw, '')) ~
    '(орех|миндал|фундук|кешью|пекан|фисташ|арахис|макадам|кокос)'
  order by
    pi.product_key,
    pi.ingredient_raw,
    pi.ingredient_normalized,
    pi.weight_text,
    pi.id
)
insert into public.product_ingredients (
  product_key,
  ingredient_raw,
  ingredient_normalized,
  tag,
  weight_text
)
select
  s.product_key,
  s.ingredient_raw,
  s.ingredient_normalized,
  'орехи',
  s.weight_text
from nut_source s
where not exists (
  select 1
  from public.product_ingredients existing
  where existing.product_key = s.product_key
    and existing.tag = 'орехи'
    and existing.ingredient_raw is not distinct from s.ingredient_raw
    and existing.ingredient_normalized is not distinct from s.ingredient_normalized
);
