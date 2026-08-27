/*
===========================================================================
SweetGift.ru | Products for Tilda Flow articles
---------------------------------------------------------------------------
Renders ingredient-matched gift baskets inside article HTML containers.
Each container preferably provides its server-side filter alias via data-alias.
Legacy articles fall back to the last /stati/ URL segment.
===========================================================================
*/

(function () {
  'use strict';

  var MODULE_NAME = 'Article Products';
  var ROOT_ATTR = 'data-sg-article-products';
  var STYLE_ID = 'sg-article-products-css';
  // Version the key so a previously cached empty response cannot hide a
  // newly configured or freshly rebuilt product selection.
  var CACHE_PREFIX = 'sg_article_products_v3_';
  var CACHE_TTL = 15 * 60 * 1000;
  var RETRY_DELAYS = [0, 750, 2000];
  var REQUEST_TIMEOUT = 6000;
  var pendingRequests = new Map();
  var observer = null;

  function debug() {
    if (window.SG && (window.SG.debug || (window.SG.core && window.SG.core.debug))) {
      console.log.apply(console, ['[SG ' + MODULE_NAME + ']'].concat(
        Array.prototype.slice.call(arguments)
      ));
    }
  }

  function escapeHtml(value) {
    if (window.SG && window.SG.core && typeof window.SG.core.escapeHtml === 'function') {
      return window.SG.core.escapeHtml(value);
    }

    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeUrl(value) {
    try {
      var raw = String(value || '').trim();
      if (!raw) return '';

      var url = new URL(raw, window.location.origin);

      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return url.href;
    } catch (error) {
      return '';
    }
  }

  function normalizeAlias(value) {
    var alias = String(value || '').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]*$/.test(alias) ? alias : '';
  }

  function aliasFromUrl() {
    var match = window.location.pathname.match(/^\/stati\/([^/]+)\/?$/i);
    if (!match) return '';

    try {
      return normalizeAlias(decodeURIComponent(match[1]));
    } catch (error) {
      return '';
    }
  }

  function resolveAlias(container) {
    var alias = normalizeAlias(container.dataset.alias);
    return alias || aliasFromUrl();
  }

  function formatPrice(value) {
    var price = Number(value);
    if (!isFinite(price) || price <= 0) return '';

    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 0
    }).format(price) + ' ₽';
  }

  function readCache(alias) {
    try {
      var cached = JSON.parse(window.sessionStorage.getItem(CACHE_PREFIX + alias) || 'null');

      if (
        cached &&
        cached.savedAt &&
        Date.now() - cached.savedAt < CACHE_TTL &&
        cached.data &&
        Array.isArray(cached.data.products) &&
        cached.data.products.length
      ) {
        return cached.data;
      }
    } catch (error) {
      debug('Cache read skipped', error);
    }

    return null;
  }

  function writeCache(alias, data) {
    if (!data || !Array.isArray(data.products) || !data.products.length) return;

    try {
      window.sessionStorage.setItem(CACHE_PREFIX + alias, JSON.stringify({
        savedAt: Date.now(),
        data: data
      }));
    } catch (error) {
      debug('Cache write skipped', error);
    }
  }

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.sg-article-products{--sg-ap-ink:#261d1f;--sg-ap-muted:#786b6e;--sg-ap-brand:#b62651;--sg-ap-line:#eadfdd;max-width:1200px;margin:50px auto 32px;padding:30px;border:1px solid var(--sg-ap-line);border-radius:24px;background:#fffaf8;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      '.sg-article-products *{box-sizing:border-box;}',
      '.sg-article-products__head{margin:0 0 22px;}',
      '.sg-article-products__title{margin:0;color:var(--sg-ap-ink);font-size:30px;line-height:1.18;font-weight:750;}',
      '.sg-article-products__subtitle{margin:9px 0 0;color:var(--sg-ap-muted);font-size:16px;line-height:1.5;}',
      '.sg-article-products__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;}',
      '.sg-article-products__card{display:flex;min-width:0;flex-direction:column;overflow:hidden;border:1px solid #eee3e0;border-radius:19px;background:#fff;color:var(--sg-ap-ink)!important;text-decoration:none!important;transition:transform .2s,border-color .2s,box-shadow .2s;}',
      '.sg-article-products__card:hover{transform:translateY(-3px);border-color:#d9afb9;box-shadow:0 13px 30px rgba(79,39,51,.12);}',
      '.sg-article-products__image{display:flex;width:100%;aspect-ratio:1/1;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(135deg,#fafafa,#f1f1f1);}',
      '.sg-article-products__image img{width:100%;height:100%;object-fit:cover;transition:transform .25s;}',
      '.sg-article-products__card:hover .sg-article-products__image img{transform:scale(1.025);}',
      '.sg-article-products__body{display:flex;min-height:176px;flex:1;flex-direction:column;padding:15px;}',
      '.sg-article-products__name{display:-webkit-box;overflow:hidden;margin:0;color:var(--sg-ap-ink);font-size:16px;line-height:1.35;font-weight:700;-webkit-line-clamp:3;-webkit-box-orient:vertical;}',
      '.sg-article-products__price{margin-top:auto;padding-top:14px;color:var(--sg-ap-ink);font-size:20px;line-height:1.2;font-weight:750;}',
      '.sg-article-products__button{display:block;margin-top:13px;padding:11px 13px;border-radius:12px;background:var(--sg-ap-brand);color:#fff;text-align:center;font-size:14px;line-height:1.2;font-weight:700;}',
      '.sg-article-products__nav{margin-top:24px;padding-top:21px;border-top:1px solid var(--sg-ap-line);}',
      '.sg-article-products__nav-title{margin:0 0 11px;color:var(--sg-ap-ink);font-size:17px;line-height:1.3;font-weight:700;}',
      '.sg-article-products__links{display:flex;flex-wrap:wrap;gap:9px;}',
      '.sg-article-products__link{display:inline-flex;padding:9px 13px;border:1px solid #dfc8c3;border-radius:999px;background:#fff;color:var(--sg-ap-brand)!important;text-decoration:none!important;font-size:14px;line-height:1.3;transition:border-color .2s,background .2s;}',
      '.sg-article-products__link:hover{border-color:var(--sg-ap-brand);background:#fff4f6;}',
      '.sg-article-products--state{margin-top:24px;margin-bottom:24px;padding:22px 24px;text-align:center;}',
      '.sg-article-products__status{margin:0;color:var(--sg-ap-muted);font-size:15px;line-height:1.5;}',
      '.sg-article-products__status--loading:before{content:"";display:inline-block;width:14px;height:14px;margin-right:9px;border:2px solid #eadfdd;border-top-color:var(--sg-ap-brand);border-radius:50%;vertical-align:-2px;animation:sg-ap-spin .8s linear infinite;}',
      '.sg-article-products__status--error{color:#9a284d;}',
      '@keyframes sg-ap-spin{to{transform:rotate(360deg);}}',
      '@media(max-width:1080px){.sg-article-products__grid{grid-template-columns:repeat(3,minmax(0,1fr));}}',
      '@media(max-width:760px){.sg-article-products{margin:36px 0 24px;padding:20px 16px;border-radius:20px;}.sg-article-products__title{font-size:25px;}.sg-article-products__subtitle{font-size:14px;}.sg-article-products__grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}.sg-article-products__body{min-height:160px;padding:12px;}.sg-article-products__name{font-size:14px;}.sg-article-products__price{font-size:17px;}.sg-article-products__button{font-size:13px;}}',
      '@media(max-width:420px){.sg-article-products__grid{grid-template-columns:1fr;}.sg-article-products__body{min-height:0;}.sg-article-products__image{aspect-ratio:4/3;}}'
    ].join('');

    document.head.appendChild(style);
  }

  function renderState(container, state, message) {
    injectCss();

    container.innerHTML = [
      '<section class="sg-article-products sg-article-products--state">',
        '<p class="sg-article-products__status sg-article-products__status--',
          escapeHtml(state),
        '">',
          escapeHtml(message),
        '</p>',
      '</section>'
    ].join('');

    container.setAttribute(ROOT_ATTR, '1');
    container.setAttribute('data-sg-state', state);
    container.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  }

  function productCard(product) {
    product = product && typeof product === 'object' ? product : {};

    var title = escapeHtml(product.title || 'Подарочная корзина');
    var url = safeUrl(product.url);
    var imageUrl = safeUrl(product.image);
    var image = imageUrl
      ? '<img src="' + escapeHtml(imageUrl) + '" alt="' + title + '" loading="lazy" decoding="async">'
      : '';
    var price = formatPrice(product.price);

    return [
      url
        ? '<a class="sg-article-products__card" href="' + escapeHtml(url) + '" title="' + title + '">'
        : '<div class="sg-article-products__card" title="' + title + '">',
        '<span class="sg-article-products__image">', image, '</span>',
        '<span class="sg-article-products__body">',
          '<span class="sg-article-products__name">', title, '</span>',
          price ? '<span class="sg-article-products__price">' + escapeHtml(price) + '</span>' : '',
          url ? '<span class="sg-article-products__button">Подробнее</span>' : '',
        '</span>',
      url ? '</a>' : '</div>'
    ].join('');
  }

  function navigationHtml(items) {
    if (!Array.isArray(items) || !items.length) return '';

    return [
      '<nav class="sg-article-products__nav" aria-label="Материалы о сырах">',
        '<h3 class="sg-article-products__nav-title">Читайте также</h3>',
        '<div class="sg-article-products__links">',
          items.map(function (item) {
            item = item && typeof item === 'object' ? item : {};
            var url = safeUrl(item.url);
            if (!url) return '';

            return '<a class="sg-article-products__link" href="' +
              escapeHtml(url) + '">' + escapeHtml(item.title) + '</a>';
          }).join(''),
        '</div>',
      '</nav>'
    ].join('');
  }

  function render(container, data) {
    injectCss();

    container.innerHTML = [
      '<section class="sg-article-products" aria-label="',
        escapeHtml(data.title || 'Подходящие подарочные корзины'),
      '">',
      '<header class="sg-article-products__head">',
        '<h2 class="sg-article-products__title">',
          escapeHtml(data.title || 'Подходящие подарочные корзины'),
        '</h2>',
        data.subtitle
          ? '<p class="sg-article-products__subtitle">' + escapeHtml(data.subtitle) + '</p>'
          : '',
      '</header>',
      '<div class="sg-article-products__grid">',
        data.products.map(productCard).join(''),
      '</div>',
      navigationHtml(data.navigation),
      '</section>'
    ].join('');

    container.setAttribute(ROOT_ATTR, '1');
    container.setAttribute('data-sg-state', 'loaded');
    container.setAttribute('aria-busy', 'false');
    debug('Rendered', data.alias, data.products.length);
  }

  function requestAlias(alias) {
    return new Promise(function (resolve, reject) {
      if (
        !window.SG ||
        !window.SG.core ||
        (
          typeof window.SG.core.rpcRead !== 'function' &&
          typeof window.SG.core.rpc !== 'function'
        )
      ) {
        reject(new Error('SweetGift Core is not ready'));
        return;
      }

      var settled = false;
      var timeoutId = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error('RPC request timed out'));
      }, REQUEST_TIMEOUT);

      function finish(callback, value) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        callback(value);
      }

      var rpc = typeof window.SG.core.rpcRead === 'function'
        ? window.SG.core.rpcRead
        : window.SG.core.rpc;

      rpc(
        'get_article_products',
        { article_alias: alias },
        function (data) {
          finish(resolve, data);
        },
        function (error) {
          finish(reject, error || new Error('RPC failed'));
        }
      );
    });
  }

  function requestAliasWithRetry(alias, attempt) {
    attempt = attempt || 0;

    return new Promise(function (resolve) {
      window.setTimeout(resolve, RETRY_DELAYS[attempt] || 0);
    }).then(function () {
      return requestAlias(alias);
    }).catch(function (error) {
      if (attempt + 1 >= RETRY_DELAYS.length) throw error;

      debug('RPC retry', alias, attempt + 2, error);
      return requestAliasWithRetry(alias, attempt + 1);
    });
  }

  function loadAlias(alias) {
    var cached = readCache(alias);

    if (cached) {
      return Promise.resolve(cached);
    }

    if (pendingRequests.has(alias)) return pendingRequests.get(alias);

    var request = requestAliasWithRetry(alias, 0).then(function (data) {
      if (data) writeCache(alias, data);
      return data;
    });

    pendingRequests.set(alias, request);
    request.then(function () {
      pendingRequests.delete(alias);
    }, function () {
      pendingRequests.delete(alias);
    });

    return request;
  }

  function processContainer(container) {
    if (!container) return;

    if (container.getAttribute('data-sg-state')) return;

    var alias = resolveAlias(container);
    if (!alias) return;

    renderState(container, 'loading', 'Подбираем подходящие подарочные корзины…');

    loadAlias(alias).then(function (data) {
      if (!container.isConnected) return;

      if (!data || !Array.isArray(data.products) || !data.products.length) {
        renderState(
          container,
          'empty',
          'Для этой статьи пока нет подходящих доступных товаров.'
        );
        debug('No configured products for', alias);
        return;
      }

      render(container, data);
    }).catch(function (error) {
      if (!container.isConnected) return;
      renderState(
        container,
        'error',
        'Не удалось загрузить подборку товаров. Обновите страницу немного позже.'
      );
      debug('RPC failed', alias, error);
    });
  }

  function scanContainers() {
    var containers = document.querySelectorAll('.sg-related-products');

    containers.forEach(function (container) {
      processContainer(container);
    });
  }

  function processAddedNode(node) {
    if (!node || node.nodeType !== 1) return;

    if (node.matches('.sg-related-products')) {
      processContainer(node);
    }

    node.querySelectorAll('.sg-related-products').forEach(function (container) {
      processContainer(container);
    });
  }

  function start() {
    scanContainers();

    observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(processAddedNode);
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
