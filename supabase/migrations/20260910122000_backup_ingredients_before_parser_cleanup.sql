-- Recoverable snapshot before rebuilding ingredient rows with the corrected
-- Tilda/YML composition parser. The storefront never reads this table.

create table if not exists private.product_ingredients_backup_20260910
as table public.product_ingredients with no data;

truncate table private.product_ingredients_backup_20260910;

insert into private.product_ingredients_backup_20260910
select * from public.product_ingredients;

revoke all on private.product_ingredients_backup_20260910
from public, anon, authenticated;

comment on table private.product_ingredients_backup_20260910 is
  'Recovery snapshot taken before the September 2026 ingredient parser cleanup.';
