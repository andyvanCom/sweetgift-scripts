-- Preserve the established 100 Alias values while applying exact catalog
-- traits that are explicitly present in coffee product names. Informational
-- topics without a stored product trait remain on the safe coffee fallback.

create or replace function public.apply_coffee_article_filter_overrides()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows bigint := 0;
begin
  update public.article_product_filters f
  set
    filter_type = x.filter_type,
    filter_value = x.filter_value,
    subtitle = x.subtitle,
    updated_at = now()
  from (
    values
      (
        'aromatnyy-kofe-v-podarok',
        'ingredient_contains',
        'bialetti perfetto moka vanilla|egoiste truffle|shazel кардамон|coffesso mokka|egoiste noir',
        'Корзины SweetGift с кофе Vanilla, Truffle, Cardamom, Mokka и Noir'
      ),
      (
        'kofe-dlya-espresso',
        'ingredient_contains',
        'egoiste espresso|illy молотый эспрессо|lavazza espresso',
        'Корзины SweetGift с кофе, в названии которого указан Espresso'
      ),
      (
        'italyanskiy-kofe-v-podarok',
        'ingredient_contains',
        'кофе illy|кофе в зернах. illy|кофе bialetti|молотый кофе bialetti|кофе lavazza|кофе молотый lavazza|lavazza espresso|piazza del caffe',
        'Корзины SweetGift с кофе Illy, Bialetti, Lavazza и Piazza Del Caffe'
      )
  ) as x(alias, filter_type, filter_value, subtitle)
  where f.alias = x.alias;

  get diagnostics v_rows = row_count;
  return jsonb_build_object('ok', true, 'filters', v_rows);
end;
$$;

revoke all on function public.apply_coffee_article_filter_overrides()
  from public;
grant execute on function public.apply_coffee_article_filter_overrides()
  to service_role;

select public.apply_coffee_article_filter_overrides();

comment on function public.apply_coffee_article_filter_overrides() is
  'Applies exact stored-name overrides without changing established Coffee article Alias values.';
