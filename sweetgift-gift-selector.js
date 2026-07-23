/*
===========================================================================
SweetGift.ru | Gift Selector by Ingredients
---------------------------------------------------------------------------
Client-side selector for /podbor-po-sostavu.
Loads the existing catalog once through get_gift_selector_catalog, then
filters and sorts products locally without additional network requests.
===========================================================================
*/

(function () {
  'use strict';

  var ROOT_SELECTOR = '[data-sg-gift-selector], #sg-gift-selector';
  var SEARCH_THRESHOLD = 30;
  var INGREDIENT_ALIASES = {
    'с икрой': 'икра',
    'икрой': 'икра',
    'красная икра': 'икра',
    'черная икра': 'икра',
    'чёрная икра': 'икра'
  };

  window.SG = window.SG || {};
  window.SG.giftSelector = window.SG.giftSelector || {
    data: null,
    loading: false,
    callbacks: []
  };

  var shared = window.SG.giftSelector;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function displayName(value) {
    var text = String(value || '').trim();
    return text ? text.charAt(0).toLocaleUpperCase('ru-RU') + text.slice(1) : '';
  }

  function formatPrice(value) {
    var price = Number(value);

    if (!isFinite(price) || price <= 0) return '';

    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 0
    }).format(price) + ' ₽';
  }

  function shortComposition(value) {
    var text = String(value || '')
      .replace(/<br\s*\/?>/gi, ', ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/^в состав[^:]*:?\s*/i, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .trim();

    if (text.length > 175) {
      text = text.slice(0, 172).replace(/[\s,;]+[^\s,;]*$/, '') + '…';
    }

    return text;
  }

  function injectCss() {
    if (document.getElementById('sg-gift-selector-css')) return;

    var style = document.createElement('style');
    style.id = 'sg-gift-selector-css';
    style.textContent = [
      '.sg-selector{--sg-red:#a9284d;--sg-red-dark:#852e43;--sg-ink:#261d1f;--sg-muted:#786b6e;--sg-line:#eadfdd;max-width:1200px;margin:0 auto;padding:34px 20px 70px;color:var(--sg-ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      '.sg-selector *{box-sizing:border-box;}',
      '.sg-selector-head{text-align:center;margin:0 auto 25px;max-width:760px;}',
      '.sg-selector-title{margin:0;font-size:clamp(28px,4vw,44px);line-height:1.12;font-weight:750;}',
      '.sg-selector-intro{margin:12px 0 0;color:var(--sg-muted);font-size:16px;line-height:1.55;}',
      '.sg-selector-panel{padding:22px;border:1px solid var(--sg-line);border-radius:22px;background:#fffaf8;box-shadow:0 12px 34px rgba(67,32,41,.07);}',
      '.sg-selector-panel-title{margin:0 0 15px;font-size:20px;line-height:1.25;}',
      '.sg-selector-search{position:relative;margin-bottom:15px;}',
      '.sg-selector-search[hidden]{display:none;}',
      '.sg-selector-search-icon{position:absolute;left:15px;top:50%;transform:translateY(-50%);pointer-events:none;}',
      '.sg-selector-search-input{width:100%;height:48px;padding:0 16px 0 43px;border:1px solid var(--sg-line);border-radius:14px;background:#fff;color:var(--sg-ink);font:inherit;outline:none;transition:border-color .2s,box-shadow .2s;}',
      '.sg-selector-search-input:focus{border-color:var(--sg-red);box-shadow:0 0 0 3px rgba(169,40,77,.12);}',
      '.sg-selector-chips{display:flex;flex-wrap:wrap;gap:9px;}',
      '.sg-selector-chip{appearance:none;border:1px solid #dccdca;border-radius:999px;background:#fff;padding:10px 14px;color:var(--sg-ink);font:600 14px/1.1 inherit;cursor:pointer;transition:transform .18s,border-color .18s,background .18s,color .18s,box-shadow .18s;}',
      '.sg-selector-chip:hover{transform:translateY(-1px);border-color:var(--sg-red);box-shadow:0 5px 14px rgba(67,32,41,.09);}',
      '.sg-selector-chip:focus-visible{outline:3px solid rgba(169,40,77,.22);outline-offset:2px;}',
      '.sg-selector-chip.is-selected{border-color:var(--sg-red);background:var(--sg-red);color:#fff;}',
      '.sg-selector-chip-count{opacity:.72;font-weight:500;}',
      '.sg-selector-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:25px 0 16px;}',
      '.sg-selector-count{font-size:17px;font-weight:650;}',
      '.sg-selector-actions{display:flex;align-items:center;gap:12px;}',
      '.sg-selector-reset{appearance:none;border:0;background:transparent;color:var(--sg-red);padding:8px 0;font:650 14px/1.2 inherit;cursor:pointer;}',
      '.sg-selector-reset:hover{color:var(--sg-red-dark);text-decoration:underline;}',
      '.sg-selector-reset[hidden]{display:none;}',
      '.sg-selector-share .sg-share-box{margin:0;}',
      '.sg-selector-share .sg-share-main{height:42px;border-color:var(--sg-line);color:var(--sg-ink);font-size:14px;font-weight:650;}',
      '.sg-selector-share .sg-share-main:hover{border-color:var(--sg-red);color:var(--sg-red);}',
      '.sg-selector-share .sg-share-menu{right:0;left:auto;}',
      '.sg-selector-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;}',
      '.sg-selector-card{display:flex;min-width:0;flex-direction:column;overflow:hidden;border:1px solid #eee;border-radius:20px;background:#fff;color:var(--sg-ink)!important;text-decoration:none!important;transition:transform .2s,border-color .2s,box-shadow .2s;}',
      '.sg-selector-card:hover{transform:translateY(-3px);border-color:var(--sg-red);box-shadow:0 12px 28px rgba(0,0,0,.08);}',
      '.sg-selector-image{display:flex;width:100%;aspect-ratio:1/1;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(135deg,#fafafa,#f1f1f1);}',
      '.sg-selector-image img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .3s;}',
      '.sg-selector-card:hover .sg-selector-image img{transform:scale(1.025);}',
      '.sg-selector-placeholder{font-size:28px;font-weight:800;color:#c6b8b5;}',
      '.sg-selector-body{display:flex;flex:1;flex-direction:column;padding:15px;}',
      '.sg-selector-name{font-size:16px;line-height:1.35;font-weight:650;}',
      '.sg-selector-composition{display:-webkit-box;margin:8px 0 0;overflow:hidden;color:var(--sg-muted);font-size:13px;line-height:1.42;-webkit-line-clamp:3;-webkit-box-orient:vertical;}',
      '.sg-selector-price{margin-top:auto;padding-top:13px;font-size:18px;font-weight:750;}',
      '.sg-selector-more{display:block;margin-top:12px;border-radius:12px;background:var(--sg-red);padding:10px 13px;color:#fff;text-align:center;font-size:14px;font-weight:700;}',
      '.sg-selector-empty,.sg-selector-status{grid-column:1/-1;padding:45px 18px;border:1px dashed var(--sg-line);border-radius:18px;text-align:center;color:var(--sg-muted);}',
      '.sg-selector-status{margin-top:18px;}',
      '@media(max-width:980px){.sg-selector-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}',
      '@media(max-width:720px){.sg-selector{padding:25px 14px 50px;}.sg-selector-panel{padding:17px;border-radius:18px;}.sg-selector-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}.sg-selector-card{border-radius:16px;}.sg-selector-body{padding:12px;}.sg-selector-name{font-size:14px;}.sg-selector-composition{font-size:12px;-webkit-line-clamp:2;}.sg-selector-price{font-size:16px;}}',
      '@media(max-width:560px){.sg-selector-toolbar{align-items:flex-start;flex-direction:column;}.sg-selector-actions{width:100%;justify-content:space-between;}.sg-selector-share .sg-share-menu{right:auto;left:0;}.sg-selector-share .sg-share-main{padding:0 14px;}}',
      '@media(max-width:420px){.sg-selector-chip{padding:9px 12px;font-size:13px;}}'
    ].join('');

    document.head.appendChild(style);
  }

  function readUrlIngredients(known) {
    var raw = new URLSearchParams(window.location.search).get('i') || '';
    var knownMap = {};

    known.forEach(function (item) {
      knownMap[normalize(item.name)] = item.name;
    });

    return raw.split(',').map(function (item) {
      var normalized = normalize(item);
      var canonical = INGREDIENT_ALIASES[normalized] || normalized;
      return knownMap[canonical];
    }).filter(Boolean).filter(function (item, index, items) {
      return items.indexOf(item) === index;
    });
  }

  function writeUrlIngredients(selected) {
    if (!window.history || typeof window.history.replaceState !== 'function') return;

    var url = new URL(window.location.href);

    if (selected.length) {
      url.searchParams.set('i', selected.join(','));
    } else {
      url.searchParams.delete('i');
    }

    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function loadData(callback) {
    if (shared.data) {
      callback(null, shared.data);
      return;
    }

    shared.callbacks.push(callback);
    if (shared.loading) return;
    shared.loading = true;

    function finish(error, data) {
      shared.loading = false;
      if (!error) shared.data = data;

      var callbacks = shared.callbacks.slice();
      shared.callbacks = [];
      callbacks.forEach(function (fn) {
        fn(error, data);
      });
    }

    if (!window.SG.core || typeof window.SG.core.rpc !== 'function') {
      finish(new Error('SweetGift Core не загружен'));
      return;
    }

    window.SG.core.rpc(
      'get_gift_selector_catalog',
      {},
      function (data) {
        finish(null, data || { ingredients: [], products: [] });
      },
      function (error) {
        finish(error || new Error('Не удалось загрузить каталог'));
      }
    );
  }

  function init(root) {
    if (!root || root.getAttribute('data-sg-initialized') === '1') return;
    root.setAttribute('data-sg-initialized', '1');
    injectCss();

    root.innerHTML =
      '<div class="sg-selector">' +
        '<header class="sg-selector-head">' +
          '<h1 class="sg-selector-title">Подбор подарочных корзин по составу</h1>' +
          '<p class="sg-selector-intro">Выберите один или несколько ингредиентов — покажем корзины, в которых есть всё выбранное.</p>' +
        '</header>' +
        '<div class="sg-selector-status">Загружаем состав подарочных корзин…</div>' +
      '</div>';

    loadData(function (error, payload) {
      var shell = root.querySelector('.sg-selector');

      if (error) {
        shell.innerHTML =
          '<div class="sg-selector-status">Не удалось загрузить каталог. Обновите страницу чуть позже.</div>';
        console.error('[SG Gift Selector]', error);
        return;
      }

      var ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];
      var products = Array.isArray(payload.products) ? payload.products : [];
      var selected = readUrlIngredients(ingredients);
      var search = '';

      shell.innerHTML =
        '<header class="sg-selector-head">' +
          '<h1 class="sg-selector-title">Подбор подарочных корзин по составу</h1>' +
          '<p class="sg-selector-intro">Выберите один или несколько ингредиентов — покажем корзины, в которых есть всё выбранное.</p>' +
        '</header>' +
        '<section class="sg-selector-panel" aria-labelledby="sg-selector-panel-title">' +
          '<h2 class="sg-selector-panel-title" id="sg-selector-panel-title">Выберите ингредиенты</h2>' +
          '<label class="sg-selector-search"' + (ingredients.length > SEARCH_THRESHOLD ? '' : ' hidden') + '>' +
            '<span class="sg-selector-search-icon" aria-hidden="true">🔍</span>' +
            '<input class="sg-selector-search-input" type="search" autocomplete="off" placeholder="Начните вводить название…" aria-label="Поиск ингредиента">' +
          '</label>' +
          '<div class="sg-selector-chips" aria-label="Ингредиенты"></div>' +
        '</section>' +
        '<div class="sg-selector-toolbar">' +
          '<div class="sg-selector-count" aria-live="polite"></div>' +
          '<div class="sg-selector-actions">' +
            '<button class="sg-selector-reset" type="button">Сбросить фильтр</button>' +
            '<div class="sg-selector-share"></div>' +
          '</div>' +
        '</div>' +
        '<div class="sg-selector-grid"></div>';

      var chipsRoot = shell.querySelector('.sg-selector-chips');
      var grid = shell.querySelector('.sg-selector-grid');
      var count = shell.querySelector('.sg-selector-count');
      var reset = shell.querySelector('.sg-selector-reset');
      var searchInput = shell.querySelector('.sg-selector-search-input');
      var shareRoot = shell.querySelector('.sg-selector-share');
      var shareBox = null;
      var shareAttempts = 0;

      function shareTitle() {
        return selected.length
          ? 'Подарочные корзины с ингредиентами: ' +
            selected.map(displayName).join(', ')
          : 'Подбор подарочных корзин по составу';
      }

      function updateShare() {
        if (!shareBox || !shareBox.__sgShareOptions) return;

        shareBox.__sgShareOptions.title = shareTitle();
        shareBox.__sgShareOptions.text =
          'Посмотрите эту подборку подарочных корзин SweetGift';
        shareBox.__sgShareOptions.url = window.location.href;
      }

      function ensureShareButton() {
        if (shareBox || !shareRoot) return;

        if (
          window.SG &&
          window.SG.share &&
          typeof window.SG.share.create === 'function'
        ) {
          shareBox = window.SG.share.create({
            buttonText: 'Поделиться подборкой',
            title: shareTitle(),
            text: 'Посмотрите эту подборку подарочных корзин SweetGift',
            url: window.location.href
          });
          shareRoot.appendChild(shareBox);
          return;
        }

        shareAttempts += 1;
        if (shareAttempts < 30) {
          setTimeout(ensureShareButton, 100);
        }
      }

      function renderChips() {
        var needle = normalize(search);

        chipsRoot.innerHTML = ingredients.filter(function (item) {
          return !needle || normalize(item.name).indexOf(needle) !== -1;
        }).map(function (item) {
          var isSelected = selected.indexOf(item.name) !== -1;
          return '<button type="button" class="sg-selector-chip' + (isSelected ? ' is-selected' : '') + '"' +
            ' data-ingredient="' + escapeHtml(item.name) + '"' +
            ' aria-pressed="' + (isSelected ? 'true' : 'false') + '">' +
            escapeHtml(displayName(item.name)) +
            ' <span class="sg-selector-chip-count">(' + Number(item.product_count || 0) + ')</span>' +
          '</button>';
        }).join('');
      }

      function filteredProducts() {
        var selectedKeys = selected.map(normalize);

        return products.map(function (product) {
          var productIngredients = (product.ingredients || []).map(normalize);
          var matches = selectedKeys.filter(function (item) {
            return productIngredients.indexOf(item) !== -1;
          }).length;

          return {
            product: product,
            matches: matches,
            hasAll: matches === selectedKeys.length
          };
        }).filter(function (item) {
          return item.hasAll;
        }).sort(function (a, b) {
          if (b.matches !== a.matches) return b.matches - a.matches;

          var popularity = Number(b.product.popularity_score || 0) -
            Number(a.product.popularity_score || 0);
          if (popularity) return popularity;

          var aPrice = Number(a.product.price);
          var bPrice = Number(b.product.price);
          if (!isFinite(aPrice) || aPrice <= 0) aPrice = Number.MAX_SAFE_INTEGER;
          if (!isFinite(bPrice) || bPrice <= 0) bPrice = Number.MAX_SAFE_INTEGER;
          if (aPrice !== bPrice) return aPrice - bPrice;

          return String(a.product.title || '').localeCompare(
            String(b.product.title || ''),
            'ru'
          );
        });
      }

      function renderProducts() {
        var results = filteredProducts();
        count.textContent = 'Найдено: ' + results.length + ' ' +
          (results.length % 10 === 1 && results.length % 100 !== 11
            ? 'корзина'
            : (results.length % 10 >= 2 && results.length % 10 <= 4 &&
              (results.length % 100 < 10 || results.length % 100 >= 20)
              ? 'корзины'
              : 'корзин'));
        reset.hidden = selected.length === 0;

        if (!results.length) {
          grid.innerHTML =
            '<div class="sg-selector-empty">Корзин с таким сочетанием пока нет. Снимите один из ингредиентов и попробуйте снова.</div>';
          return;
        }

        grid.innerHTML = results.map(function (result, index) {
          var product = result.product;
          var title = escapeHtml(product.title || 'Подарочная корзина SweetGift');
          var url = escapeHtml(product.product_key || product.url || '#');
          var image = escapeHtml(product.image || '');
          var composition = shortComposition(product.composition);
          var price = formatPrice(product.price);

          return '<a class="sg-selector-card" href="' + url + '" title="' + title + '">' +
            '<div class="sg-selector-image">' +
              (image
                ? '<img loading="' + (index < 4 ? 'eager' : 'lazy') + '" decoding="async" src="' + image + '" alt="' + title + '">'
                : '<span class="sg-selector-placeholder" aria-hidden="true">SG</span>') +
            '</div>' +
            '<div class="sg-selector-body">' +
              '<div class="sg-selector-name">' + title + '</div>' +
              (composition ? '<div class="sg-selector-composition">' + escapeHtml(composition) + '</div>' : '') +
              (price ? '<div class="sg-selector-price">' + escapeHtml(price) + '</div>' : '') +
              '<span class="sg-selector-more">Подробнее</span>' +
            '</div>' +
          '</a>';
        }).join('');
      }

      function render() {
        renderChips();
        renderProducts();
        writeUrlIngredients(selected);
        updateShare();
      }

      chipsRoot.addEventListener('click', function (event) {
        var chip = event.target.closest('[data-ingredient]');
        if (!chip) return;

        var ingredient = chip.getAttribute('data-ingredient');
        var index = selected.indexOf(ingredient);

        if (index === -1) {
          selected.push(ingredient);
        } else {
          selected.splice(index, 1);
        }

        render();
      });

      reset.addEventListener('click', function () {
        selected = [];
        search = '';
        if (searchInput) searchInput.value = '';
        render();
      });

      if (searchInput) {
        searchInput.addEventListener('input', function () {
          search = searchInput.value;
          renderChips();
        });
      }

      ensureShareButton();
      render();
    });
  }

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll(ROOT_SELECTOR), init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
