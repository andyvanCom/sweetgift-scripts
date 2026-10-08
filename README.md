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
| `order-photos` | реальные фото из мастерской | при наличии `[data-sg-order-photos]` |

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

## Фото из мастерской

В один блок T123 на нужной странице вставьте:

```html
<div data-sg-order-photos></div>
```

Существующий loader подключает `sweetgift-order-photos.js` из manifest. Модуль
выводит ленту только в этих контейнерах; без контейнера не загружает JSON и фото.
Скорость можно задать атрибутом `data-speed="14"` (пиксели в секунду, максимум 40).
Лента перемешивается при открытии, поддерживает паузу, мобильное листание,
клавиатуру и системное уменьшение анимации. Можно разместить несколько контейнеров.

`https://app.sweetgift.ru/order-photos/gallery.json` и его фотографии — проверенная
публичная подборка на собственном сервере SweetGift, а не прямой доступ к закрытому MAX-архиву и не автоматическая публикация
каждого нового снимка. В JSON разрешены `src`, необязательные `productTitle` и `productUrl`.
Название и HTTPS-ссылку на карточку sweetgift.ru нужно проверить по товару заказа; не переносите сюда комментарии клиента.
Каждая новая фотография требует визуальной проверки и удаления метаданных.
Фото и JSON не хранятся в этом репозитории. Подборка обновляется отдельно от
JS-модуля; каждый URL фото неизменяемый, без обращения к приватному архиву.

Подборка автоматически пополняется на сервере после проверки конфиденциальности
и точного сопоставления с товаром. Модуль проверяет публичный JSON каждые 5 минут
на видимой странице, сохраняет паузу и прежние фото при ошибке. Во время наведения,
листания или фокуса на ссылке обновление откладывается. На странице без контейнера
запросов и таймера нет.

Проверки: `node --check sweetgift-order-photos.js`, `node scripts/test-order-photos.js`.
Браузерная проверка обновлений: `node scripts/test-order-photos-refresh-browser.js`
(нужен Playwright; `PLAYWRIGHT_MODULE_PATH` и `WORKSHOP_BROWSER_EXECUTABLE` позволяют
использовать внешний установленный runtime/Chrome).

## Supabase

Project ref: `rvgvbxipccbkytmhltmi`.

Edge Functions: `import-yml-products`, `import-articles-index`, `classify-articles`, `article-products`, `gift-selector-request`, `proposal-mailer`, `admin-dashboard`, `send-daily-report`.

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

Галерея на app.sweetgift.ru передаётся через EDGE напрямую с API во Франции по HTTPS. Это сохраняет единое хранилище и избегает наблюдавшихся обрывов загрузки через Cloudflare.
