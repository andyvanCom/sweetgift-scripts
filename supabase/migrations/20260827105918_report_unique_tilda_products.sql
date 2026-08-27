create or replace function public.get_daily_report_text()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_text text;
  v_database_bytes bigint := pg_database_size(current_database());
  v_database_mb numeric := round(v_database_bytes / 1024.0 / 1024.0, 1);
  v_database_warning text;
  v_unique_products bigint;
  v_available_products bigint;
  v_historical_urls bigint;
begin
  select
    count(distinct coalesce(
      substring(coalesce(url, product_key) from 'tproduct/([0-9]+)'),
      product_key
    )),
    count(*) filter (where available = true),
    count(*) - count(distinct coalesce(
      substring(coalesce(url, product_key) from 'tproduct/([0-9]+)'),
      product_key
    ))
  into v_unique_products, v_available_products, v_historical_urls
  from public.products_catalog;

  v_database_warning := case
    when v_database_bytes >= 350::bigint * 1024 * 1024 then
      E'\n⚠️ ВНИМАНИЕ: размер базы превысил 350 МБ. Необходимо проверить рост и очистку данных.'
    else ''
  end;

  select
'Доброе утро!\n\nНочная обработка SweetGift завершена.\n\n📦 ТОВАРЫ\nВсего уникальных товаров: ' || v_unique_products || '\nДоступных товаров: ' || v_available_products || '\nИсторических URL-дублей: ' || v_historical_urls || '\n\n📰 СТАТЬИ\nВсего статей: ' || (select count(*) from public.articles_index) || '\nСтатей без SEO-темы: ' || (select count(*) from public.articles_index where seo_topic_title is null) || '\n\n🔗 ПЕРЕЛИНКОВКА\nКарточек с SEO-блоками: ' || (select count(*) from public.product_card_seo_blocks) || '\nТоваров без SEO-блоков: ' || (
  select count(*)
  from public.products_catalog pc
  left join public.product_card_seo_blocks b on b.product_key = pc.product_key
  where pc.available = true and b.product_key is null
) || '\n\n🏷 СУЩНОСТИ\nСущностей статей: ' || (select count(*) from public.article_seo_entities) || '\nСущностей товаров: ' || (select count(*) from public.product_seo_entities) || '\n\n📈 АНАЛИТИКА\nПросмотров товаров вчера: ' || (
  select count(*)
  from public.product_events
  where created_at >= current_date - interval '1 day'
    and created_at < current_date
) || '\nПросмотров статей всего: ' || (select coalesce(sum(views),0) from public.article_views) || '\n\n🛒 ЗАКАЗЫ\nЗаказов вчера: ' || (
  select count(distinct order_id)
  from public.product_orders
  where created_at >= current_date - interval '1 day'
    and created_at < current_date
) || '\n\n💾 БАЗА ДАННЫХ\nРазмер базы: ' || v_database_mb || ' МБ из 500 МБ (' || round(v_database_bytes * 100.0 / (500::bigint * 1024 * 1024), 1) || '%)\nПодробные события: 180 дней, более старые — агрегировано' || v_database_warning || '\n\n⚠️ ТРЕБУЕТ ВНИМАНИЯ\nСтатей без сущностей: ' || (
  select count(*)
  from public.articles_index ai
  left join public.article_seo_entities e on e.article_key = ai.article_key
  where e.article_key is null
) || '\nТоваров без сущностей: ' || (
  select count(*)
  from public.products_catalog pc
  left join public.product_seo_entities e on e.product_key = pc.product_key
  where pc.available = true and e.product_key is null
) || '\n\nОтчет сформирован: ' || now()::text
  into v_text;

  return replace(v_text, chr(92) || 'n', chr(10));
end;
$function$;

revoke all on function public.get_daily_report_text() from public, anon, authenticated;
grant execute on function public.get_daily_report_text() to service_role;

comment on function public.get_daily_report_text() is
'Daily operational report. Product totals use stable Tilda product IDs so historical URL rows are not reported as unavailable products.';
