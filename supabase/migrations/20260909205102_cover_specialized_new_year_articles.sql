-- Some New Year articles belong to ingredient-specific SEO clusters. Keep
-- those holiday pages in the same dedicated basket section as the main New
-- Year clusters. "novyy-uchebnyy-god" is intentionally not a winter holiday.
update public.article_product_filters
set filter_type = 'category_slug',
    filter_value = 'novogodnie_korziny',
    title = 'Новогодние подарочные корзины',
    subtitle = 'Праздничные корзины из специального новогоднего раздела SweetGift',
    updated_at = now()
where enabled = true
  and alias <> 'novyy-uchebnyy-god-uchitel'
  and alias ~ '(novogod|novyy-god|novym-godom|novye-god|rozhdestv)';

select public.request_article_product_cache_refresh();
