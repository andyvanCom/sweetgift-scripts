-- Holiday New Year article clusters must never fall back to evergreen fruit
-- or food baskets. Their cards come only from the dedicated Tilda section.
update public.article_product_filters
set filter_type = 'category_slug',
    filter_value = 'novogodnie_korziny',
    title = 'Новогодние подарочные корзины',
    subtitle = 'Праздничные корзины из специального новогоднего раздела SweetGift',
    updated_at = now()
where enabled = true
  and cluster_key like 'new-year-%';

select public.request_article_product_cache_refresh();
