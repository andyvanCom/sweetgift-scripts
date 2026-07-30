-- Configure the honey article container using the existing
-- article_product_filters -> article_product_cache architecture.
--
-- Do not use a generic "мед" substring: catalog rows also contain unrelated
-- words such as "медведь" and "ананас медовый".

insert into public.article_product_filters (
  alias,
  filter_type,
  filter_value,
  title,
  subtitle,
  limit_count,
  enabled,
  cluster_key,
  cluster_order
)
values (
  'honey-in-gift-baskets',
  'ingredient_contains',
  'мед натуральный|мёд натуральный|мед цветоч|мёд цветоч|цветочный мед|цветочный мёд|мед в сотах|мёд в сотах|мед суфле|мёд суфле|мед-суфле|мёд-суфле|крем мед|крем мёд|крем-мед|крем-мёд|мед медолюбов|мёд медолюбов|медовый десерт|орехи в меду|миндаль в меду|фундук в меду|кешью в меду|мед с апельсином|мёд с апельсином|мед с облепихой|мёд с облепихой',
  'Мёд в подарочных корзинах',
  'Подарочные корзины SweetGift с натуральным мёдом, крем-мёдом, мёдом-суфле и орехами в мёде',
  12,
  true,
  'honey-seo-cluster',
  0
)
on conflict (alias) do update
set
  filter_type = excluded.filter_type,
  filter_value = excluded.filter_value,
  title = excluded.title,
  subtitle = excluded.subtitle,
  limit_count = excluded.limit_count,
  enabled = excluded.enabled,
  cluster_key = excluded.cluster_key,
  cluster_order = excluded.cluster_order,
  updated_at = now();
