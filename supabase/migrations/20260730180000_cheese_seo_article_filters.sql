-- Configure the extended cheese SEO cluster using the existing
-- article_product_filters -> get_article_products() architecture.
--
-- Deliberately avoid the generic `сыр` substring: it also occurs in cured
-- meat descriptions such as `сырокопченая` and `сыровяленая`.

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
values
  (
    'cheese-in-gift-baskets',
    'ingredient_contains',
    'камамбер|camembert|сыр бри|сыр brie|petit бри|горгонзол|горгондзол|gorgonzol|rockforo|rockfor|roquefort|рокфор|dorblu|дор блю|дорблю|blue cheese|голубой плесенью|чеддер|чеддар|cheddar|маасдам|масдам|маасдамер|maasdam|mssdam|качотт|caciott|сен-полен|la paulina гайя|ле руж|тартуфо|лябан|швейцарский чиз|пармезан|parmigiano|раклет|чечил|эмментал|нормандбер|турмезан|thurmesan|боккочини|bocconcini|тильзитер|гауда|gouda|бельпер|фета|feta|грюйер|gruy|реблошон|тет де муан|tete de moine|ле пайе|gusto perfetto|president snack|swiss gourmet|bergbaron',
    'Сыры в подарочных корзинах',
    'Подарочные корзины SweetGift с настоящими сырами в составе',
    12,
    true,
    'cheese-seo-cluster',
    0
  ),
  (
    'camembert-v-podarochnyh-korzinah',
    'ingredient_contains',
    'камамбер|camembert',
    'Камамбер в подарочных корзинах',
    'Корзины SweetGift с камамбером разных производителей и видов',
    12,
    true,
    'cheese-seo-cluster',
    1
  ),
  (
    'brie-v-podarochnyh-korzinah',
    'ingredient_contains',
    'сыр бри|сыр brie|petit бри|brie president|brie prezident',
    'Бри в подарочных корзинах',
    'Корзины SweetGift с сыром бри в составе',
    12,
    true,
    'cheese-seo-cluster',
    2
  ),
  (
    'gorgonzola-v-podarochnyh-korzinah',
    'ingredient_contains',
    'горгонзол|горгондзол|gorgonzol',
    'Горгонзола в подарочных корзинах',
    'Корзины SweetGift с горгонзолой, включая найденные варианты написания',
    12,
    true,
    'cheese-seo-cluster',
    3
  ),
  (
    'rockforo-v-podarochnyh-korzinah',
    'ingredient_contains',
    'rockforo|rockfor|roquefort|рокфор',
    'Rockforo и рокфор в подарочных корзинах',
    'Корзины SweetGift с сырами Rockforo и найденными вариантами названия',
    12,
    true,
    'cheese-seo-cluster',
    4
  ),
  (
    'maasdam-v-podarochnyh-korzinah',
    'ingredient_contains',
    'maasdam|маасдам|масдам|маасдамер|mssdam',
    'Маасдам в подарочных корзинах',
    'Корзины SweetGift с маасдамом и вариантами его написания',
    12,
    true,
    'cheese-seo-cluster',
    5
  ),
  (
    'parmezan-v-podarochnyh-korzinah',
    'ingredient_contains',
    'пармезан|parmigiano',
    'Пармезан в подарочных корзинах',
    'Корзины SweetGift с настоящим пармезаном в составе',
    12,
    true,
    'cheese-seo-cluster',
    6
  ),
  (
    'cheddar-v-podarochnyh-korzinah',
    'ingredient_contains',
    'чеддер|чеддар|cheddar',
    'Чеддер в подарочных корзинах',
    'Корзины SweetGift с классическим, красным и трюфельным чеддером',
    12,
    true,
    'cheese-seo-cluster',
    7
  ),
  (
    'gauda-v-podarochnyh-korzinah',
    'ingredient_contains',
    'гауда|gouda',
    'Гауда в подарочных корзинах',
    'Корзины SweetGift с сыром гауда в составе',
    12,
    true,
    'cheese-seo-cluster',
    8
  ),
  (
    'blue-cheese-v-podarochnyh-korzinah',
    'ingredient_contains',
    'горгонзол|горгондзол|gorgonzol|rockforo|rockfor|roquefort|рокфор|dorblu|дор блю|дорблю|blue cheese|голубой плесенью',
    'Сыры с голубой плесенью в подарочных корзинах',
    'Корзины SweetGift с горгонзолой, Dorblu, Rockforo и другими голубыми сырами',
    12,
    true,
    'cheese-seo-cluster',
    9
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
