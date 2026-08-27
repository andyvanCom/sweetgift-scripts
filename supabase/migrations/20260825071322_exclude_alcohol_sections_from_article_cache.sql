-- Article recommendations must never contain products whose catalog page
-- belongs to one of the prohibited alcohol-specific sections. Match only the
-- category/path, not product composition: non-alcoholic gifts and ordinary
-- baskets mentioning a drink in their text remain eligible.

create or replace function public.is_article_product_section_allowed(
  product_category_slug text,
  product_url text
)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $function$
  select not (
    lower(trim(coalesce(product_category_slug, ''))) = any (array[
      'korziny-s-vodkoy',
      'korzina-s-konyakom-v-podarok-muzhchine',
      'korziny-s-cognac',
      'podarochnye-korziny-s-vinom',
      'korziny-s-fruktami-i-shampanskim',
      'korziny-s-shampanskim',
      'korziny-s-romom',
      'korziny-s-dzhinom',
      'pivnaya-korzina-v-podarok',
      'korziny-s-pivom'
    ]::text[])
    or lower(coalesce(product_url, '')) ~
      '/(korziny-s-vodkoy|korzina-s-konyakom-v-podarok-muzhchine|korziny-s-cognac|podarochnye-korziny-s-vinom|korziny-s-fruktami-i-shampanskim|korziny-s-shampanskim|korziny-s-romom|korziny-s-dzhinom|pivnaya-korzina-v-podarok|korziny-s-pivom)(/|$)'
  );
$function$;

revoke all on function public.is_article_product_section_allowed(text, text)
  from public, anon, authenticated;
grant execute on function public.is_article_product_section_allowed(text, text)
  to service_role;

create or replace function public.guard_article_product_cache_section()
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

revoke all on function public.guard_article_product_cache_section()
  from public, anon, authenticated;

drop trigger if exists guard_article_product_cache_section
  on public.article_product_cache;
create trigger guard_article_product_cache_section
before insert or update of product_key on public.article_product_cache
for each row execute function public.guard_article_product_cache_section();

create or replace function public.purge_article_cache_for_prohibited_section()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_article_product_section_allowed(new.category_slug, new.url)
  then
    delete from public.article_product_cache c
    where c.product_key = new.product_key;
  end if;
  return new;
end;
$function$;

revoke all on function public.purge_article_cache_for_prohibited_section()
  from public, anon, authenticated;

drop trigger if exists purge_article_cache_for_prohibited_section
  on public.products_catalog;
create trigger purge_article_cache_for_prohibited_section
after insert or update of category_slug, url on public.products_catalog
for each row execute function public.purge_article_cache_for_prohibited_section();

delete from public.article_product_cache c
using public.products_catalog p
where p.product_key = c.product_key
  and not public.is_article_product_section_allowed(p.category_slug, p.url);

comment on function public.is_article_product_section_allowed(text, text) is
  'Central allow-list guard for article recommendations; rejects products from alcohol-specific catalog sections by category/path.';
