# SweetGift Functions

Актуально на 2026-09-02.

## Edge Functions

### `import-yml-products`

Импортирует YML-каталог Tilda в `products_catalog`, `product_variants`, `product_ingredients` и связанные сущности. Нормализует URL, доступность, состав и варианты. Записывает результат в `system_job_logs`.

### `import-articles-index`

Пакетно синхронизирует опубликованные статьи Tilda «Потоки» в `articles_index`. Использует limit 100 в ночном режиме, продолжает обработку следующими пакетами и синхронизирует правила известных SEO-кластеров.

### `classify-articles`

Назначает отсутствующие SEO-темы и сущности пакетами. Не выполняет тяжёлый общий пересчёт подборок внутри одного короткого Edge-вызова. Ошибка и фактическое количество записываются в job log.

### `article-products`

Публичная read-only выдача готовой подборки по Alias. Поддерживает единичный Alias и manifest-страницы для экспорта статического кеша. Использует `get_article_products`; результат допускает CDN-кеширование. Frontend имеет статический и прямой RPC fallback.

### `gift-selector-request`

Принимает запрос пользователя, когда выбранному составу не соответствует готовый товар. Валидирует поля, сохраняет/отправляет только предусмотренные формой данные и отправляет письмо через подключённую почтовую инфраструктуру SweetGift.

### `admin-dashboard`

Backend `/admin`: одноразовый код на email, проверка admin-роли из `app_metadata`, метрики, состояние pipeline и безопасный запуск разрешённых операций. Постоянный пароль в T123 отсутствует; активная браузерная сессия переиспользуется.

### `send-daily-report`

Формирует и отправляет ежедневный отчёт с каталожными, статейными, SEO-, заказными и pipeline-метриками. Проверяет сверку источников, размер базы и предупреждает от 350 MB. Почтовые и служебные секреты находятся в Supabase Secrets.

## Публичные RPC

| RPC | Назначение |
|---|---|
| `get_article_products(alias)` | готовые товары и «Читайте также» для статьи |
| `get_product_card_seo_blocks_cached(key)` | четыре готовых блока карточки товара |
| `get_gift_selector_catalog()` | корзины и ингредиенты для подбора |
| `get_gift_box_selector_catalog()` | наборы/боксы и ингредиенты |
| `get_gift_quiz_recommendations(answers, limit)` | ранжирование единого квиза |
| `get_public_top_lists_page_period(period)` | товарные рейтинги |
| `get_public_top_articles_page_period(period, limit)` | рейтинг статей |
| `get_product_activity_badges(keys)` | агрегированная активность товаров |
| `get_recent_product_activity()` | данные live popup |
| `miniapp_search_products_v1(query, limit)` | ограниченный поиск по названию |
| `neuromaria_search_products_v2/v3(query, limit)` | поиск с вариантами и CSV-доступностью |
| `neuromaria_product_details_v1(reference)` | состав, размеры и варианты одного товара |

Поиск `miniapp_search_products_v1` поддерживает точное и подстрочное совпадение, но не исправляет опечатки через trigram similarity.

## RPC записи событий

- `track_product_event` — просмотры, корзина, покупка и оценки;
- `track_product_order` — обезличенная позиция заказа;
- `track_gift_quiz_event` — шаги и результаты квиза;
- `increment_article_view`, `increment_article_view_daily`, `like_article` — аналитика статей.

Frontend не имеет прямого write-доступа к исходным аналитическим таблицам.

## Служебные RPC

### Подборки и SEO

- `refresh_article_product_cache()` — транзакционный ночной кеш всех Alias;
- `request_article_product_cache_refresh()` — безопасный асинхронный запуск;
- `refresh_product_card_seo_blocks_all(limit)` — блоки карточек;
- `refresh_product_card_seo_blocks_one(key, limit)` — одна карточка;
- `refresh_article_product_recommendations(limit)` — статьи для товаров;
- `refresh_product_seo_entities_all()` — сущности товаров;
- `refresh_product_new_year_entities()` — новогодние признаки.

### Семантика и кластерные правила

- `assign_missing_article_seo_topics_batch(limit)`;
- `sync_honey_article_filters`;
- `sync_nut_article_filters`;
- `sync_builder_day_article_filters`;
- `sync_coffee_article_filters`;
- `sync_tea_article_filters`;
- `sync_caviar_article_filters`;
- `sync_fruit_article_filters`;
- `sync_new_year_article_filters`;
- `sync_gift_idea_article_filters`.

Синхронизация использует существующие Alias и upsert, не удаляет старую семантику и не создаёт фиктивные продуктовые теги.

### Рейтинги и мониторинг

- `refresh_all_top_lists()` и периодные варианты;
- `get_system_pipeline_health()`;
- `get_daily_report_text()`;
- `get_article_product_cache_status()`;
- `archive_old_product_events(180)`;
- `capture_admin_daily_metrics(90)`.

## Расписание Supabase cron

Время указано в UTC.

| Время | Job | Действие |
|---|---|---|
| `5 * * * *` | `refresh-top-lists-hourly` | обновить рейтинги |
| `0 4 * * *` | `import-yml-products-daily` | импорт каталога |
| `30 4 * * *` | `import-articles-index-daily` | импорт до 100 статей за пакет |
| `45 4 * * *` | `classify-articles-daily` | темы и сущности |
| `0 5 * * *` | `refresh-article-product-cache-daily` | кеш всех Alias, timeout 10 минут |
| `15 5 * * *` | `refresh-product-card-seo-blocks-daily` | блоки карточек |
| `30 5 * * *` | `refresh-article-product-recommendations-daily` | статьи для товаров |
| `35 5 * * *` | `archive-product-events-daily` | retention 180 дней |
| `45 5 * * *` | `send-daily-report` | утренний отчёт |
| `50 5 * * *` | `capture-admin-daily-metrics` | снимок на 90 дней |

GitHub Action `article-products-cache.yml` отдельно запускается в 05:30 UTC и публикует изменившиеся JSON. При изменении расписания нельзя запускать тяжёлые операции параллельно.

## Последовательность ночного pipeline

```text
import-yml-products
  → import-articles-index
  → classify-articles
  → refresh-article-product-cache
  → refresh-product-card-seo-blocks
  → refresh-article-product-recommendations
  → retention
  → send-daily-report
  → admin metrics
```

Отчёт считается успешным только если задачи завершились вовремя и контрольные количества источников совпадают с базой. `success` со слишком старым timestamp не считается текущим успешным запуском.

## Статический кеш

`scripts/export-article-products-cache.py` получает manifest страницами из Edge Function и записывает:

- `article-products-cache/manifest.json`;
- один JSON на Alias.

GitHub Action коммитит только фактические изменения. Frontend запрашивает кеш по commit-resolved jsDelivr URL и использует Edge/RPC как fallback.

## Правила изменения

1. Не включать секреты в URL, код, документацию и cron SQL миграций.
2. Edge Function и сохранённый в GitHub исходник должны совпадать.
3. Изменение RPC оформлять миграцией и проверять реальным вызовом.
4. Для SECURITY DEFINER фиксировать `search_path`, grants и лимиты.
5. Длительные операции выносить из пользовательского запроса в cron/cache.
6. Записывать понятный статус, processed count и ошибку в `system_job_logs`.
7. После изменений проверять security/performance advisors.
