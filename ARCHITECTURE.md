# SweetGift Architecture

Документ описывает архитектуру платформы SweetGift.ru.

Последнее обновление:
2026-07-05

---

# Общая схема

                   Пользователь
                        │
                        ▼
                  Сайт SweetGift
                  (Tilda)

                        │
                        ▼
              sweetgift-loader.js

                        │
        ┌───────────────┼──────────────────┐
        ▼               ▼                  ▼

  Core Module     Analytics Module     Share Module

        │
        ▼

Recent Products
Top Pages
Badges
Live Popup
Article Stats

                        │

                        ▼

                  Supabase

        ┌───────────────┼──────────────────┐
        ▼               ▼                  ▼

   PostgreSQL        Edge Functions      Storage

---

# Компоненты

## Loader

Файл

```
sweetgift-loader.js
```

Задачи

- загрузить manifest
- определить страницу
- подключить необходимые модули
- не загружать лишний JS

Использует

```
sweetgift-manifest.json
```

---

# Manifest

Хранит

- список модулей
- версии
- страницы подключения

Пример

```
{
    "name":"recent-products",
    "version":"8"
}
```

После любого изменения JS необходимо увеличить version.

---

# Core

Файл

```
sweetgift-core.js
```

Основные функции

- rpc()
- escapeHtml()
- isProductPage()
- fingerprint
- cookie helpers
- localStorage helpers

Все остальные модули используют Core.

---

# Product Analytics

```
sweetgift-product-analytics.js
```

Отправляет события

- просмотр товара
- добавить в корзину
- избранное
- переходы

RPC

```
track_product_event
```

Сохраняет

```
product_events
```

---

# Product Badges

Использует агрегированные таблицы.

Показывает

- купили N раз
- просмотрели N раз
- популярный товар

---

# Recent Products

```
sweetgift-recent-products.js
```

Работает полностью без сервера.

Использует

```
localStorage
```

Хранит

```
20 товаров
```

Показывает

```
4 товара
```

Desktop

```
сеткой
```

Mobile

```
горизонтальный свайп
```

Использует

```
JSON-LD ItemList
```

---

# Top Pages

```
sweetgift-top-pages.js
```

Используется

```
/top/*
```

Получает данные

RPC

```
get_public_top_lists_page_period()
```

Поддерживает

- популярные
- категории
- ингредиенты
- рекомендации

---

# Live Popup

Использует

аналитику товаров.

Показывает последние действия пользователей.

---

# Article Stats

Используется

```
/stati/*
```

Показывает

- просмотры
- время чтения

---

# Supabase

Используется как Backend.

---

## Основные таблицы

### product_events

Все события пользователей.

Типы

- view

- add_to_cart

- favorite

- listing_click

---

### product_stats

Агрегированные показатели.

Пересчитываются каждый час.

Используются

- бейджи
- рейтинги
- рекомендации

---

### top_lists

Описание рейтингов.

---

### top_list_items

Содержимое рейтингов.

---

### products_catalog

Полная база товаров.

Источник

```
YML
```

Содержит

- название
- описание
- цену
- старую цену
- изображения
- состав
- JSON товара

После первого импорта

```
694 товаров
```

---

### product_ingredients

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

---

### feed_sources

Источники импорта.

Поля

- url

- enabled

- last_run

- last_status

- last_error

---

# Edge Functions

---

## import-yml-products

Импортирует

```
https://sweetgift.ru/tstore/yml/b0c84d5fa302ff1f376384ee71710226.yml
```

Обновляет

products_catalog

product_ingredients

feed_sources

---

# Автоматизация

Используется

```
pg_cron
```

+

```
pg_net
```

Ежедневно

```
04:30 UTC
```

вызывается

```
import-yml-products
```

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

Top Lists

↓

Recommendations

↓

AI
```

---

# Поток аналитики

```
Пользователь

↓

JS

↓

track_product_event()

↓

product_events

↓

product_stats

↓

бейджи

↓

рейтинги

↓

рекомендации
```

---

# Планируемые модули

## Similar Products

По совпадению ингредиентов.

---

## Bought Together

По совместным покупкам.

---

## Ingredient Pages

Автоматическая генерация

```
с сыром

с кофе

с икрой

с медом

...
```

---

## AI Catalog

Поиск

```
корзина

с сыром

хамоном

кофе
```

---

## Dynamic Filters

Автоматически строятся по

```
product_ingredients
```

---

## Smart Recommendations

Используют одновременно

- ингредиенты

- аналитику

- просмотры

- покупки

- рейтинг

---

# Репозиторий

```
sweetgift-scripts
```

Структура

```
/

README.md

CHANGELOG.md

ARCHITECTURE.md

sweetgift-loader.js

sweetgift-manifest.json

sweetgift-core.js

sweetgift-product-analytics.js

sweetgift-product-badges.js

sweetgift-live-popup.js

sweetgift-share.js

sweetgift-recent-products.js

sweetgift-top-pages.js

sweetgift-article-stats.js

supabase/

functions/

import-yml-products/
```

---

# Правила разработки

После изменения JS

1.

увеличить version

в manifest

2.

commit

3.

push

Loader сам загрузит новую версию.

---

# Долгосрочная цель

SweetGift должен стать полностью автономной платформой.

Источником данных является не Tilda, а собственная база Supabase.

Все рекомендации, SEO, AI, фильтры, рейтинги и аналитика работают поверх единой базы данных.