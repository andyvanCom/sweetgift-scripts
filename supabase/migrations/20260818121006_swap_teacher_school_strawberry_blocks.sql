-- Put strawberry/chocolate and berry bouquets into the first product block
-- while preserving article URLs and navigation on the primary alias. The
-- existing basket rule moves to the technical -additional alias.

with pairs as (
  select
    primary_filter.alias as primary_alias,
    additional_filter.alias as additional_alias,
    primary_filter.filter_type as primary_filter_type,
    primary_filter.filter_value as primary_filter_value,
    primary_filter.title as primary_title,
    primary_filter.subtitle as primary_subtitle,
    additional_filter.filter_type as additional_filter_type,
    additional_filter.filter_value as additional_filter_value,
    additional_filter.title as additional_title,
    additional_filter.subtitle as additional_subtitle
  from public.article_product_filters primary_filter
  join public.article_product_filters additional_filter
    on additional_filter.alias = primary_filter.alias || '-additional'
  where primary_filter.cluster_key in (
      'teacher-school-teacher',
      'teacher-school-child',
      'teacher-school-flowers',
      'teacher-school-women',
      'teacher-school-budget'
    )
    and additional_filter.filter_type = 'category_slug'
)
update public.article_product_filters target
set
  filter_type = case
    when target.alias = pairs.primary_alias
      then pairs.additional_filter_type
    else pairs.primary_filter_type
  end,
  filter_value = case
    when target.alias = pairs.primary_alias
      then pairs.additional_filter_value
    else pairs.primary_filter_value
  end,
  title = case
    when target.alias = pairs.primary_alias
      then pairs.additional_title
    else pairs.primary_title
  end,
  subtitle = case
    when target.alias = pairs.primary_alias
      then pairs.additional_subtitle
    else pairs.primary_subtitle
  end,
  updated_at = now()
from pairs
where target.alias in (pairs.primary_alias, pairs.additional_alias);
