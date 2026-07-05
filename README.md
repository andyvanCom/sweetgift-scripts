# SweetGift Scripts

Общий репозиторий модулей SweetGift.ru.

Используется для:

- JS-модулей сайта
- Edge Functions Supabase
- аналитики
- автоматического импорта каталога
- генерации SEO-страниц
- рейтингов товаров
- AI-функций

---

# Структура проекта

```
sweetgift-scripts/

├── sweetgift-loader.js
├── sweetgift-manifest.json
├── sweetgift-core.js
├── sweetgift-product-analytics.js
├── sweetgift-product-badges.js
├── sweetgift-live-popup.js
├── sweetgift-share.js
├── sweetgift-recent-products.js
├── sweetgift-top-pages.js
├── sweetgift-article-stats.js

├── supabase/
│   └── functions/
│       └── import-yml-products/
│           └── index.ts

└── README.md
```

---

# Загрузка модулей

На сайте подключается только Loader.

```
sweetgift-loader.js
```

Он:

- загружает manifest
- определяет страницу
- подключает только нужные модули
- использует версионирование

пример

```
https://cdn.jsdelivr.net/gh/andyvanCom/sweetgift-scripts@main/sweetgift-loader.js?v=stable2
```

---

# Manifest

Версии модулей находятся в

```
sweetgift-manifest.json
```

пример

```
{
  "name":"recent-products",
  "version":"8"
}
```

После изменения JS обязательно увеличивать version.

---

# Core

Файл

```
sweetgift-core.js
```

Содержит общие функции

- rpc()
- isProductPage()
- escapeHtml()
- fingerprint
- helpers

Все остальные модули используют Core.

---

# Product Analytics

```
sweetgift-product-analytics.js
```

Отправляет события

- просмотр товара
- добавление в корзину
- избранное
- клики

Данные сохраняются в Supabase.

Используется RPC

```
track_product_event
```

---

# Product Badges

```
sweetgift-product-badges.js
```

Показывает

- купили N раз
- просмотрели N раз
- популярный товар
- рекомендации

Использует агрегированные таблицы.

---

# Live Popup

```
sweetgift-live-popup.js
```

Показывает последние действия покупателей.

Использует данные аналитики.

---

# Recent Products

```
sweetgift-recent-products.js
```

Показывает

Продолжить просмотр

Особенности

- localStorage
- без Supabase
- JSON-LD ItemList
- lazy loading изображений

Desktop

- 4 товара

Mobile

- горизонтальный свайп
- подсказка "Листайте товары"

Контейнер

```
<div class="sg-recent-products"></div>
```

---

# Top Pages

```
sweetgift-top-pages.js
```

Используется на страницах

```
/top/*
```

Поддерживает разные режимы

```
popular

category

ingredient

custom
```

Использует RPC

```
get_public_top_lists_page_period
```

---

# Article Stats

```
sweetgift-article-stats.js
```

Показывает

- просмотры
- время чтения
- популярность статьи

---

# Supabase

Используется

- Analytics
- Product Catalog
- Ingredients
- Ratings
- Top Lists

---

# Edge Function

```
import-yml-products
```

Назначение

Импорт товаров из YML Tilda.

Источник

```
https://sweetgift.ru/tstore/yml/b0c84d5fa302ff1f376384ee71710226.yml
```

Импортирует

- товары
- изображения
- цену
- старую цену
- описание
- состав
- доступность

После импорта автоматически разбирает ингредиенты.

Последний импорт

```
694 товаров
4720 ингредиентов
```

---

# Таблицы

## products_catalog

Основной каталог.

Используется

- похожие товары
- SEO
- фильтры
- AI

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

Например

```
cheese

caviar

coffee

honey
```

---

# Распознаваемые ингредиенты

Сейчас

- икра
- сыр
- колбаса
- чай
- кофе
- мёд
- варенье
- краб
- мясо
- олень
- медведь
- сёмга
- оливки
- конфеты
- шоколад
- печенье
- виноград
- яблоки
- папайя
- питахайя
- бананы
- мандарины
- ананас
- киви
- клубника
- нектарины
- малина
- ежевика

Поддерживаются различные склонения слов.

---

# Cron

Настроен ежедневный импорт.

```
04:30 UTC
```

Job

```
import-yml-products-daily
```

После импорта

обновляется

- products_catalog
- product_ingredients

---

# SEO

Планируются автоматические страницы

```
/podarochnye-korziny-s-syrom

/podarochnye-korziny-s-kofe

/podarochnye-korziny-s-ikroy

/podarochnye-korziny-s-medom
```

и десятки других.

---

# План развития

## AI

Поиск товаров по составу

например

```
корзина

с сыром

хамоном

кофе
```

---

## SEO

Автоматическая генерация

- Title
- Description
- H1
- тексты
- перелинковка

---

## Рекомендации

Будут использовать одновременно

- аналитику
- ингредиенты
- популярность
- совместные просмотры

---

# Обновление JS

После изменения файла

1.

увеличить version

```
sweetgift-manifest.json
```

2.

commit

```
git add .

git commit -m "..."
```

3.

push

```
git push
```

Loader автоматически загрузит новую версию.

---

# Проверка версии

```
window.SG
```

или

```
window.SG.recentProducts.version
```

или

```
document.querySelector('script[src*="recent-products"]').src
```

---

# Основные технологии

- Tilda
- Supabase
- PostgreSQL
- Edge Functions
- JSDelivr
- GitHub
- Fingerprint
- pg_cron
- pg_net

---

Проект постоянно развивается.