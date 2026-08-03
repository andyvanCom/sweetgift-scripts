-- SamSebe asks whether the order is for the customer. "Нет" therefore means
-- a gift and "Да" means a self-purchase. Normalize this on the database side
-- as well, so cached or older tracker versions cannot invert the metric.

create or replace function public.normalize_product_order_gift_flag()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_choice text := lower(
    regexp_replace(trim(coalesce(new.samsebe, '')), '\s+', ' ', 'g')
  );
begin
  if v_choice ~ '^(нет|no)($|[[:space:],.;:!?-])'
     or v_choice ~ 'не[[:space:]]+себе|подар|друг|получател' then
    new.is_gift := true;
  elsif v_choice ~ '^(да|yes)($|[[:space:],.;:!?-])'
        or v_choice ~ 'себе|сам' then
    new.is_gift := false;
  end if;

  return new;
end;
$$;

drop trigger if exists product_orders_normalize_gift_flag
  on public.product_orders;

create trigger product_orders_normalize_gift_flag
before insert or update of samsebe, is_gift
on public.product_orders
for each row execute function public.normalize_product_order_gift_flag();

-- Repair existing anonymous analytics. Unknown answers intentionally remain
-- unchanged instead of being guessed.
update public.product_orders
set is_gift = true
where lower(regexp_replace(trim(coalesce(samsebe, '')), '\s+', ' ', 'g'))
        ~ '^(нет|no)($|[[:space:],.;:!?-])'
   or lower(coalesce(samsebe, ''))
        ~ 'не[[:space:]]+себе|подар|друг|получател';

update public.product_orders
set is_gift = false
where not coalesce(is_gift, false)
  and (
    lower(regexp_replace(trim(coalesce(samsebe, '')), '\s+', ' ', 'g'))
      ~ '^(да|yes)($|[[:space:],.;:!?-])'
    or lower(coalesce(samsebe, '')) ~ 'себе|сам'
  );

revoke all on function public.normalize_product_order_gift_flag()
  from public, anon, authenticated;

comment on function public.normalize_product_order_gift_flag() is
  'Derives is_gift from the SamSebe answer without storing personal data.';
