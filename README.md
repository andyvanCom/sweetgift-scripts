# SweetGift Scripts

Репозиторий frontend-модулей и Supabase Edge Functions для SweetGift.ru.

Проект используется для:

- динамической загрузки JS-модулей сайта;
- аналитики товаров и статей;
- рейтингов и популярных подборок;
- SEO-блоков и перелинковки;
- импорта каталога и индекса статей;
- автоматической классификации статей;
- ежедневного технического отчёта.

---

# Структура проекта

```text
sweetgift-scripts/
├── sweetgift-loader.js
├── sweetgift-manifest.json
├── sweetgift-core.js
├── sweetgift-product-analytics.js
├── sweetgift-order-tracker.js
├── sweetgift-product-badges.js
├── sweetgift-product-seo-blocks.js
├── sweetgift-product-top-lists.js
├── sweetgift-live-popup.js
├── sweetgift-share.js
├── sweetgift-recent-products.js
├── sweetgift-top-pages.js
├── sweetgift-top-widgets.js
├── sweetgift-top-articles.js
├── sweetgift-article-stats.js
├── sweetgift-copy-source.js
├── supabase/
│   ├── config.toml
│   └── functions/
│       ├── import-yml-products/
│       ├── import-articles-index/
│       ├── classify-articles/
│       └── send-daily-report/
├── ARCHITECTURE.md
├── DATABASE.md
├── SCHEMA.md
├── FUNCTIONS.md
├── ROADMAP.md
└── CHANGELOG.md
```

---

# Загрузка модулей

На сайте подключается только loader:

```text
sweetgift-loader.js
```

Пример подключения через jsDelivr:

```text
https://cdn.jsdelivr.net/gh/andyvanCom/sweetgift-scripts@main/sweetgift-loader.js?v=stable2
```

Loader:

- загружает `sweetgift-manifest.json`;
- определяет текущую страницу;
- подключает `sweetgift-core.js`;
- подключает только подходящие модули;
- использует версии из manifest для обновления CDN-кеша;
- предотвращает повторную загрузку модулей.

---

# Manifest

Список модулей и их версии находятся в:

```text
sweetgift-manifest.json
```

Типовая запись:

```json
{
  "name": "recent-products",
  "enabled": true,
  "src": "sweetgift-recent-products.js",
  "version": "10",
  "pages": ["all"]
}
```

После изменения JS-модуля необходимо увеличить его `version` в manifest.

---

# Frontend Modules

## Core

```text
sweetgift-core.js
```

Общие функции для остальных модулей:

- RPC-запросы;
- определение типа страницы;
- экранирование HTML;
- нормализация URL;
- служебные идентификаторы;
- helpers.

## Product Analytics

```text
sweetgift-product-analytics.js
```

Отправляет обезличенные события товаров в Supabase.

Использует RPC:

```text
track_product_event
```

## Order Tracker

```text
sweetgift-order-tracker.js
```

После успешной отправки корзины Tilda записывает через `track_product_order`
обезличенный состав заказа, суммы, тип доставки и признаки открытки. Имена,
контакты, адрес и сам текст поздравления в аналитику не передаются.

## Product Badges

```text
sweetgift-product-badges.js
```

Показывает агрегированную активность товара:

- просмотры;
- популярность;
- покупки;
- рекомендации.

## Product SEO Blocks

```text
sweetgift-product-seo-blocks.js
```

Выводит готовые SEO-блоки на карточках товаров.

## Product Top Lists

```text
sweetgift-product-top-lists.js
```

Модуль для товарных рейтингов. В manifest сейчас отключён.

## Live Popup

```text
sweetgift-live-popup.js
```

Показывает обезличенные уведомления о действиях покупателей.

## Share

```text
sweetgift-share.js
```

Добавляет сценарии шаринга страницы и копирования ссылки.

## Recent Products

```text
sweetgift-recent-products.js
```

Показывает блок недавно просмотренных товаров.

Особенности:

- хранение в `localStorage`;
- работа без Supabase;
- JSON-LD ItemList;
- lazy loading изображений;
- адаптивный вывод на desktop и mobile.

## Top Pages

```text
sweetgift-top-pages.js
```

Используется на страницах:

```text
/top/*
```

Использует RPC:

```text
get_public_top_lists_page_period
```

## Top Widgets

```text
sweetgift-top-widgets.js
```

Показывает компактные виджеты рейтингов на страницах сайта.

## Top Articles

```text
sweetgift-top-articles.js
```

Используется для рейтингов популярных статей.

## Article Stats

```text
sweetgift-article-stats.js
```

Показывает статистику статьи:

- просмотры;
- время чтения;
- лайки;
- популярность.

## Copy Source

```text
sweetgift-copy-source.js
```

Добавляет ссылку на источник при копировании текста статьи.

---

# Supabase Edge Functions

## import-yml-products

Импортирует товарный каталог из YML-фида Tilda.

Обновляет:

- `products_catalog`;
- `product_ingredients`;
- `feed_sources`.

## import-articles-index

Импортирует индекс статей из sitemap-фидов SweetGift.ru.

Обновляет:

- `articles_index`;
- связанные автоматические теги и метаданные.

## classify-articles

Классифицирует статьи по тематическим сущностям:

- recipient;
- occasion;
- age;
- product_type;
- style;
- ingredient.

## send-daily-report

Формирует и отправляет ежедневный технический отчёт.

Секреты и SMTP-настройки хранятся только в переменных окружения Supabase.

---

# Документация

- `ARCHITECTURE.md` — общая архитектура платформы.
- `DATABASE.md` — логика базы данных и подсистем.
- `SCHEMA.md` — справочник таблиц и связей.
- `FUNCTIONS.md` — Edge Functions, RPC и плановые задачи.
- `ROADMAP.md` — планы развития.
- `CHANGELOG.md` — история значимых изменений.

---

# Правила разработки

- Не хранить в репозитории секреты, токены, пароли и service role key.
- После изменения JS-модуля увеличивать его `version` в `sweetgift-manifest.json`.
- После изменения Edge Function проверять и деплоить её через Supabase CLI.
- После изменения базы фиксировать SQL и обновлять документацию.
- Значимые изменения добавлять в `CHANGELOG.md`.
