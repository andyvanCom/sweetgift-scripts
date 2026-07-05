# DATABASE.md

# SweetGift Database Documentation

Последнее обновление

2026-07-05

---

# Backend

Используется

- Supabase
- PostgreSQL
- Edge Functions
- pg_cron
- pg_net

---

# Общая схема

```
                     Tilda

                        │

                        ▼

                    YML Feed

                        │

                        ▼

            import-yml-products

                        │

        ┌───────────────┼───────────────────┐
        ▼               ▼                   ▼

products_catalog   product_ingredients   feed_sources

                        │

                        ▼

      рекомендации / SEO / AI / фильтры

```

---

# Таблицы

---

## product_events

Хранит сырые события пользователей.

Используется

- аналитика
- популярность
- рекомендации

### Поля

| поле | тип |
|------|------|
| id | bigint |
| product_key | text |
| event_type | text |
| title | text |
| image | text |
| category | text |
| category_slug | text |
| source | text |
| channel | text |
| page_url | text |
| referrer | text |
| fingerprint | text |
| rating | numeric |
| created_at | timestamptz |

### event_type

```
view

add_to_cart

favorite

listing_click

purchase
```

---

## product_stats

Агрегированная статистика.

Пересчитывается каждый час.

Используется

- бейджи
- топы
- рекомендации

### Поля

| поле | описание |
|------|----------|
| product_key | товар |
| views | просмотры |
| add_to_cart | корзина |
| favorites | избранное |
| purchases | покупки |

---

## product_stats_cache

Кэш статистики.

Используется фронтендом.

---

## top_lists

Описание подборок.

Например

```
Популярные подарки

Подарочные корзины

Часто покупают

Часто смотрят
```

---

## top_list_items

Товары внутри подборок.

### Поля

```
top_list_id

product_key

position

score
```

---

## products_catalog

Полный каталог товаров.

Источник

```
YML
```

После первого импорта

```
694 товаров
```

### Основные поля

| поле | описание |
|------|----------|
| product_key | ключ |
| title | название |
| url | ссылка |
| category | категория |
| price | цена |
| old_price | старая цена |
| image | главное фото |
| images | массив фото |
| description | описание |
| composition | состав |
| available | наличие |
| raw | JSON товара |

---

## product_ingredients

Связь

```
товар

↓

ингредиент

↓

tag
```

После первого импорта

```
4720 записей
```

### Поля

| поле | описание |
|------|----------|
| product_key | товар |
| ingredient | найденный текст |
| tag | нормализованный тег |

пример

```
сыр раклет

↓

сыр

↓

cheese
```

---

## feed_sources

Источники импорта.

### Поля

| поле | описание |
|------|----------|
| id | PK |
| name | имя |
| url | ссылка |
| enabled | использовать |
| last_run_at | последний запуск |
| last_status | success/error |
| last_error | текст ошибки |

---

# RPC

---

## track_product_event()

Назначение

Запись действий пользователя.

Используется

```
sweetgift-product-analytics.js
```

Возвращает

```
новую статистику товара
```

---

## get_public_top_lists_page_period()

Используется

```
sweetgift-top-pages.js
```

Параметры

```
today

yesterday

week

month

quarter
```

Возвращает

```
готовые подборки товаров
```

---

## refresh_product_stats()

Пересчет статистики.

Запускается cron.

---

## refresh_top_lists()

Перестраивает подборки.

Использует

```
product_stats
```

---

# Edge Functions

---

## import-yml-products

Источник

```
https://sweetgift.ru/tstore/yml/b0c84d5fa302ff1f376384ee71710226.yml
```

Импортирует

- товары
- изображения
- состав
- цены
- описание

После импорта

обновляет

```
products_catalog

product_ingredients

feed_sources
```

---

# Cron

---

## import-yml-products-daily

Запускается

```
ежедневно

04:30 UTC
```

Использует

```
pg_cron

+

pg_net
```

Вызывает

Edge Function

```
import-yml-products
```

---

## refresh-product-stats

Запускается

```
каждый час
```

Пересчитывает

```
product_stats

top_lists
```

---

# Использование таблиц

## Recent Products

```
localStorage
```

не использует БД.

---

## Product Badges

Использует

```
product_stats
```

---

## Live Popup

Использует

```
product_events
```

---

## Top Pages

Использует

```
top_lists

top_list_items
```

---

## SEO

Использует

```
products_catalog

product_ingredients
```

---

## AI

Будет использовать

```
products_catalog

product_ingredients

product_stats

product_events
```

---

# Планируемые таблицы

---

## ingredients

Справочник ингредиентов.

```
id

tag

slug

title

seo_title

description

icon
```

---

## ingredient_pages

SEO страницы.

Например

```
корзины с сыром

корзины с кофе

корзины с икрой
```

---

## related_products

Похожие товары.

По совпадению ингредиентов.

---

## bought_together

Совместные покупки.

---

## ai_embeddings

Векторный поиск.

Используется AI.

---

# Поток данных

```
Tilda

↓

YML

↓

Edge Function

↓

products_catalog

↓

product_ingredients

↓

SEO

↓

Top Pages

↓

Recommendations

↓

AI Assistant
```

---

# Индексы

Рекомендуется

```
product_events(product_key)

product_events(created_at)

product_stats(product_key)

products_catalog(category)

product_ingredients(tag)

product_ingredients(product_key)
```

---

# Общий размер

На июль 2026

```
694 товаров

4720 ингредиентов

несколько тысяч событий аналитики

ежедневное обновление каталога

ежечасное обновление статистики
```

---

# Долгосрочная цель

Supabase становится главным источником данных проекта.

Tilda используется только как CMS.

Все рекомендации, аналитика, AI, фильтры, SEO и поиск работают поверх собственной базы данных.