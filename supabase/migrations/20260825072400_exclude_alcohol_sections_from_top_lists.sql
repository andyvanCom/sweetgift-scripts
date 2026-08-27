-- Apply the same catalog-section policy to the materialized /top lists.

create or replace function public.guard_top_list_product_section()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_allowed boolean;
begin
  select public.is_article_product_section_allowed(p.category_slug, p.url)
  into v_allowed
  from public.products_catalog p
  where p.product_key = new.product_key;

  if coalesce(v_allowed, true) = false then
    return null;
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_top_list_product_section()
  from public, anon, authenticated;

drop trigger if exists guard_top_list_product_section
  on public.top_list_items;
create trigger guard_top_list_product_section
before insert or update of product_key on public.top_list_items
for each row execute function public.guard_top_list_product_section();

delete from public.top_list_items t
using public.products_catalog p
where p.product_key = t.product_key
  and not public.is_article_product_section_allowed(p.category_slug, p.url);
