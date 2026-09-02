# SweetGift Database

Актуально на 2026-09-02.

## Проект

Supabase project ref: `rvgvbxipccbkytmhltmi`.

Supabase — рабочее хранилище каталога, статей, семантики, рекомендаций, аналитики и состояния фоновых процессов. Tilda остаётся исходным источником опубликованного каталога и статей.

## Принципы

1. Схема и серверная логика версионируются в `supabase/migrations/`.
2. Перед применением необходимо сравнить локальные миграции с историей Supabase.
3. Применённую миграцию нельзя запускать повторно под другим именем.
4. Тяжёлые вычисления выполняются заранее и сохраняются в кеш-таблицах.
5. Все public-таблицы защищены RLS; frontend работает только через разрешённые RPC/SELECT.
6. SECURITY DEFINER функции имеют фиксированный `search_path`, ограниченный результат и явные grants.
7. Service role, SMTP и cron-секреты не хранятся в GitHub.

## Подсистемы

### Каталог

- `products_catalog` — одна стабильная запись товара Tilda;
- `product_variants` — размеры, издания и другие варианты товара;
- `product_ingredients` — разобранный и нормализованный состав;
- `ingredient_tag_rules` — правила классификации ингредиентов;
- `product_seo_entities` — сущности товара;
- `feed_sources` — состояние источников импорта;
- `tilda_catalog_csv_imports`, `tilda_catalog_csv_rows` — снимок CSV и фактическая доступность.

`product_key` — стабильный ключ аналитики и рекомендаций. Варианты не должны раздувать число уникальных товаров в ежедневном отчёте.

### Статьи и SEO

- `articles_index` — опубликованный индекс Tilda «Потоки»;
- `article_views`, `article_views_daily` — просмотры и дневные агрегаты;
- `seo_topics`, `seo_topic_queries` — группы семантики и запросы;
- `article_seo_entities`, `product_seo_entities` — извлечённые связи;
- `article_product_filters` — Alias статьи и безопасное правило подбора;
- `article_product_cache` — готовые товары и навигация для Alias;
- `article_product_recommendations` — статьи для карточек товаров;
- `product_card_seo_blocks` — готовые блоки карточки.

`article_product_links` и часть старых topic-link таблиц сохранены для совместимости, но текущая выдача статей опирается на filters/cache и product card blocks.

### Аналитика

- `product_events` — подробные обезличенные события;
- `product_events_daily` — дневные агрегаты;
- `products_stats` — накопленная статистика товара;
- `product_orders` — одна строка на позицию оформленного заказа;
- `gift_quiz_events` — воронка квиза;
- `article_views*` — статистика статей;
- `top_lists`, `top_list_items` — готовые рейтинги;
- `admin_daily_metrics` — дневные агрегаты админки.

### Системное состояние

- `system_job_logs` — состояние и результат импортов/пересчётов;
- `feed_sources` — числа в источниках и время последней синхронизации;
- RPC `get_system_pipeline_health` и `get_daily_report_text` — контроль pipeline.

## Ключевые RPC

### Публичное чтение

- `get_article_products(text)`;
- `get_product_card_seo_blocks_cached(text)`;
- `get_gift_selector_catalog()`;
- `get_gift_box_selector_catalog()`;
- `get_gift_quiz_recommendations(jsonb, integer)`;
- `get_public_top_lists_page_period(text)`;
- `get_public_top_articles_page_period(text, integer)`;
- `get_product_activity_badges(text[])`;
- `miniapp_search_products_v1(text, integer)`;
- `neuromaria_search_products_v2/v3(text, integer)`;
- `neuromaria_product_details_v1(text)`.

### Запись событий

- `track_product_event(...)`;
- `track_product_order(jsonb)`;
- `track_gift_quiz_event(...)`;
- RPC просмотров и реакций статей.

### Служебные пересчёты

- `refresh_all_top_lists()`;
- `refresh_product_card_seo_blocks_all(integer)`;
- `refresh_article_product_recommendations(integer)`;
- `refresh_article_product_cache()`;
- `request_article_product_cache_refresh()`;
- `assign_missing_article_seo_topics_batch(integer)`;
- `refresh_product_seo_entities_all()`;
- кластерные `sync_*_article_filters(jsonb)`.

## Доступность товара

`products_catalog.available` формируется импортом. Для мини-приложения дополнительно используется последний Tilda CSV-снимок: пустое Quantity трактуется как неограниченный остаток, а не ноль. Перед диагностикой «недоступных» товаров необходимо сравнивать YML, CSV, варианты и фактическую страницу Tilda.

Специализированные разделы с алкоголем исключаются из публичных подборок отдельными серверными guards. Это не означает удаление исторических записей каталога.

## Политика хранения

- подробные `product_events`: 180 дней;
- `product_events_daily`: агрегированная история;
- `admin_daily_metrics`: 90 дней;
- каталог, статьи, семантика, заказы и SEO-связи: пока нужны проекту;
- персональные данные покупателей в аналитике не сохраняются.

Ежедневный отчёт предупреждает при размере базы от 350 MB.

## Миграционный drift

На 2026-09-02 в GitHub восстановлен файл `20260901100120_neuromaria_product_details_v1.sql`, который уже был применён в рабочей базе. Его нельзя применять повторно: файл добавлен для соответствия репозитория истории Supabase и развёртывания на новых окружениях.

## Проверка изменения базы

После DDL/RPC-изменения:

1. проверить SQL и grants;
2. применить миграцию один раз;
3. убедиться, что версия появилась в истории миграций;
4. выполнить реальный вызов функции;
5. проверить security/performance advisors;
6. обновить `SCHEMA.md`, `FUNCTIONS.md` и `CHANGELOG.md`;
7. commit/push идентичного SQL в GitHub.
