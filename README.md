# SweetGift Scripts

Актуально на 2026-09-02.

Публичный репозиторий frontend-модулей, Supabase Edge Functions, миграций и автоматизаций SweetGift.ru:

```text
https://github.com/andyvanCom/sweetgift-scripts
```

Для переноса разработки на Apollo1 начните с [`APOLLO1_HANDOFF.md`](APOLLO1_HANDOFF.md).

## Назначение

Tilda отвечает за страницы, каталог, статьи и оформление заказов. Этот проект добавляет поверх неё:

- модульный frontend через единый loader и manifest;
- импорт каталога и индекса статей в Supabase;
- структурированный состав товаров и варианты каталога;
- аналитику товаров, статей, квиза и обезличенных заказов;
- рейтинги, SEO-блоки и двустороннюю перелинковку;
- подбор товаров по составу и единый квиз выбора подарка;
- заранее рассчитанные подборки товаров внутри статей;
- ночной pipeline, статический CDN-кеш и ежедневный отчёт;
- административную панель `/admin` с одноразовым кодом на email.

## Основные файлы

```text
sweetgift-loader.js                 единая точка подключения на Tilda
sweetgift-manifest.json             модули, версии и правила страниц
sweetgift-core.js                   Supabase/RPC и общие helpers
sweetgift-article-products.js       товары и «Читайте также» в статьях
sweetgift-gift-selector.js          два подбора по составу
sweetgift-gift-quiz.js              единый разветвлённый квиз
sweetgift-order-tracker.js          обезличенная аналитика заказов
sweetgift-product-seo-blocks.js     SEO-блоки карточки товара
article-products-cache/             готовые JSON-подборки для jsDelivr
scripts/                            импорт семантики и экспорт кеша
supabase/functions/                 Edge Functions
supabase/migrations/                история схемы и серверной логики
.github/workflows/                  автоматизация GitHub Actions
```

## Frontend-модули

Актуальный состав и версии всегда находятся в `sweetgift-manifest.json`.

| Модуль | Назначение | Где работает |
|---|---|---|
| `core` | RPC, нормализация, экранирование | все страницы |
| `share` | системный шаринг и копирование ссылки | все страницы |
| `product-analytics` | события товаров | все страницы |
| `order-tracker` | позиции и признаки оформленного заказа | все страницы |
| `product-badges` | просмотры и активность товара | все страницы |
| `live-popup` | обезличенная недавняя активность | все страницы |
| `article-stats` | просмотры, реакции и шаринг статей | `/stati/*` |
| `article-products` | товары и «Читайте также» | `/stati/*` |
| `recent-products` | недавно просмотренные товары | все страницы |
| `top-pages` | страницы рейтингов | `/top/*` |
| `top-widgets` | компактные рейтинговые блоки | все страницы |
| `copy-source` | обработка копирования статей | `/stati/*` |
| `top-articles` | рейтинг статей | `/top/articles` |
| `product-seo-blocks` | SEO-блоки карточки товара | все страницы |
| `gift-selector` | подбор корзин/наборов по составу | две страницы подбора |
| `gift-quiz` | корзины, боксы и клубника в шоколаде | при наличии контейнера |

`product-top-lists` сохранён в manifest, но отключён.

После изменения frontend-файла обязательно увеличьте его `version` в manifest. Loader подключается в Tilda один раз:

```html
<script>
(function(){
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/andyvanCom/sweetgift-scripts@main/sweetgift-loader.js?v=stable2';
  s.async = true;
  document.head.appendChild(s);
})();
</script>
```

## Supabase

Project ref: `rvgvbxipccbkytmhltmi`.

Edge Functions: `import-yml-products`, `import-articles-index`, `classify-articles`, `article-products`, `gift-selector-request`, `admin-dashboard`, `send-daily-report`.

Схема, RPC и cron изменяются только через файлы в `supabase/migrations/`. Перед применением сверяйте локальный список с историей миграций проекта.

## Статические подборки статей

Тяжёлое сопоставление выполняется ночью в Supabase. Затем `scripts/export-article-products-cache.py` экспортирует готовые ответы в `article-products-cache/`. Workflow `.github/workflows/article-products-cache.yml` запускается ежедневно в 05:30 UTC и вручную.

Frontend сначала использует статический JSON через jsDelivr, затем Edge/RPC как резерв. Это ускоряет карточки и защищает от временной деградации Edge Functions.

## Проверки

```bash
node --check sweetgift-article-products.js
node -e "JSON.parse(require('fs').readFileSync('sweetgift-manifest.json','utf8'))"
node scripts/test-article-products.js
git diff --check
git status --short
```

После push проверяйте опубликованную страницу и фактический URL версии JS/JSON через jsDelivr.

## Документация

- `ARCHITECTURE.md` — архитектура и потоки данных;
- `DATABASE.md` — правила работы с Supabase;
- `SCHEMA.md` — таблицы и ключевые RPC;
- `FUNCTIONS.md` — Edge Functions, cron и pipeline;
- `GIFT_QUIZ.md` — логика квиза;
- `ROADMAP.md` — выполненное и дальнейшие задачи;
- `CHANGELOG.md` — история изменений;
- `imports/README.md` — импорт семантики;
- `APOLLO1_HANDOFF.md` — перенос на Apollo1.

## Безопасность

Репозиторий публичный. Не храните здесь пароли, SMTP-реквизиты, service role, JWT, приватные токены, персональные данные покупателей или значения секретных cron headers. Секреты находятся только в Supabase Secrets/защищённом окружении.
