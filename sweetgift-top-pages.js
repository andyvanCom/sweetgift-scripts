/*
===========================================================================
SweetGift.ru | Top Pages
---------------------------------------------------------------------------
Детальные страницы рейтингов товаров SweetGift.
Периоды: сегодня, вчера, неделя, месяц, квартал.
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};

  var VERSION = '1';
  var CSS_ID = 'sg-top-pages-css';
  var ROOT_SELECTOR = '.sg-top-detail';
  var READY_ATTRIBUTE = 'data-sg-top-pages-ready';
  var WAITING_ATTRIBUTE = 'data-sg-top-pages-waiting';
  var EMPTY_MESSAGE = 'Пока недостаточно данных для формирования рейтинга.';
  var ERROR_MESSAGE = 'Не удалось загрузить рейтинг. Попробуйте обновить страницу.';

  window.SG.topPages = {
    version: VERSION
  };

  function escapeHtml(text) {
    return window.SG.core.escapeHtml(text);
  }

  function getPeriodFromUrl() {
    var search = String(window.location.search || '').replace(/^\?/, '');
    var parts = search ? search.split('&') : [];
    var allowed = ['today', 'yesterday', 'week', 'month', 'quarter'];
    var period = 'week';
    var i;
    var pair;
    var key;

    for (i = 0; i < parts.length; i += 1) {
      pair = parts[i].split('=');
      try {
        key = decodeURIComponent(pair[0] || '');
        if (key === 'period') {
          period = decodeURIComponent((pair[1] || '').replace(/\+/g, ' '));
          break;
        }
      } catch (error) {
        period = 'week';
      }
    }

    return allowed.indexOf(period) !== -1 ? period : 'week';
  }

  function normalizePath(value) {
    var anchor = document.createElement('a');
    var path;

    anchor.href = String(value || '');
    path = anchor.pathname || String(value || '').split('#')[0].split('?')[0];

    if (path.charAt(0) !== '/') {
      path = '/' + path;
    }

    path = path.replace(/\/+$/, '');
    return path || '/';
  }

  function parseLimit(value) {
    var limit = parseInt(value, 10);
    return isNaN(limit) || limit < 0 ? 24 : limit;
  }

  function injectCss() {
    var css;
    var style;

    if (document.getElementById(CSS_ID)) return;

    css = [
      '.sg-top-detail{max-width:1180px;margin:0 auto 60px;padding:0 18px;font-family:Arial,sans-serif;color:#222;}',
      '.sg-top-detail *{box-sizing:border-box;}',
      '.sg-top-detail-title{margin:0 0 12px;font-size:36px;line-height:1.15;font-weight:700;color:#222;}',
      '.sg-top-detail-subtitle{max-width:800px;margin:0 0 24px;font-size:16px;line-height:1.5;color:#666;}',
      '.sg-top-detail-periods{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 26px;}',
      '.sg-top-detail-period{display:inline-flex;align-items:center;justify-content:center;padding:10px 15px;border:1px solid #eee;border-radius:999px;background:#fff;color:#222!important;font-size:14px;line-height:1.2;text-decoration:none!important;transition:.2s;}',
      '.sg-top-detail-period:hover,.sg-top-detail-period.is-active{border-color:#e60000;background:#fff5f5;color:#e60000!important;}',
      '.sg-top-detail-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;}',
      '.sg-top-detail-card{display:flex;min-width:0;flex-direction:column;overflow:hidden;border:1px solid #eee;border-radius:20px;background:#fff;color:#222!important;text-decoration:none!important;transition:transform .2s,border-color .2s,box-shadow .2s;}',
      '.sg-top-detail-card:hover{transform:translateY(-2px);border-color:#e60000;box-shadow:0 10px 26px rgba(0,0,0,.07);}',
      '.sg-top-detail-image{display:flex;width:100%;aspect-ratio:1/1;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(135deg,#fafafa,#f1f1f1);}',
      '.sg-top-detail-image img{display:block;width:100%;height:100%;object-fit:cover;}',
      '.sg-top-detail-placeholder{display:flex;width:72px;height:72px;align-items:center;justify-content:center;border-radius:50%;background:#fff;color:#e60000;font-size:34px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.06);}',
      '.sg-top-detail-body{display:flex;flex:1;flex-direction:column;padding:15px;}',
      '.sg-top-detail-badge{align-self:flex-start;margin:0 0 9px;padding:5px 9px;border-radius:999px;background:#fff5f5;color:#e60000;font-size:11px;line-height:1.2;font-weight:700;}',
      '.sg-top-detail-name{font-size:16px;line-height:1.35;font-weight:700;color:#222;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.sg-top-detail-loading,.sg-top-detail-empty,.sg-top-detail-error{padding:22px;border-radius:18px;background:#fafafa;color:#777;}',
      '@media(max-width:900px){.sg-top-detail-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;}}',
      '@media(max-width:640px){.sg-top-detail{padding:0 14px;}.sg-top-detail-title{font-size:28px;}.sg-top-detail-subtitle{font-size:14px;}.sg-top-detail-periods{flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch;}.sg-top-detail-periods::-webkit-scrollbar{display:none;}.sg-top-detail-period{flex:0 0 auto;}.sg-top-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}.sg-top-detail-card{border-radius:16px;}.sg-top-detail-body{padding:11px;}.sg-top-detail-name{font-size:14px;}.sg-top-detail-badge{font-size:10px;}}'
    ].join('');

    style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function findList(data, targetUrl) {
    var lists = data && data.lists ? data.lists : data;
    var targetPath = normalizePath(targetUrl);
    var i;

    if (!lists || typeof lists.length !== 'number') return null;

    for (i = 0; i < lists.length; i += 1) {
      if (normalizePath(lists[i] && lists[i].url) === targetPath) {
        return lists[i];
      }
    }

    return null;
  }

  function renderPeriods(period) {
    var periods = [
      ['today', 'Сегодня'],
      ['yesterday', 'Вчера'],
      ['week', 'Неделя'],
      ['month', 'Месяц'],
      ['quarter', 'Квартал']
    ];
    var path = window.location.pathname || '/';
    var html = '<nav class="sg-top-detail-periods" aria-label="Период рейтинга">';
    var i;

    for (i = 0; i < periods.length; i += 1) {
      html += '<a class="sg-top-detail-period' + (periods[i][0] === period ? ' is-active' : '') +
        '" href="' + escapeHtml(path + '?period=' + encodeURIComponent(periods[i][0])) + '">' +
        escapeHtml(periods[i][1]) + '</a>';
    }

    return html + '</nav>';
  }

  function renderHeader(root, period) {
    var title = root.getAttribute('data-title') || '';
    var subtitle = root.getAttribute('data-subtitle') || '';

    return '<h1 class="sg-top-detail-title">' + escapeHtml(title) + '</h1>' +
      (subtitle ? '<p class="sg-top-detail-subtitle">' + escapeHtml(subtitle) + '</p>' : '') +
      renderPeriods(period);
  }

  function renderEmpty(root, period, targetUrl) {
    console.warn('[SG Top Pages] Список не найден или пуст:', targetUrl);
    root.innerHTML = renderHeader(root, period) +
      '<div class="sg-top-detail-empty">' + EMPTY_MESSAGE + '</div>';
  }

  function render(root, list, period, targetUrl) {
    var items = list && (list.items || list.products);
    var limit = parseLimit(root.getAttribute('data-limit'));
    var badge = root.getAttribute('data-badge') || '';
    var html;
    var i;
    var item;
    var title;
    var url;
    var image;

    if (!items || !items.length) {
      renderEmpty(root, period, targetUrl);
      return;
    }

    items = Array.prototype.slice.call(items, 0, limit);
    html = renderHeader(root, period) + '<div class="sg-top-detail-grid">';

    for (i = 0; i < items.length; i += 1) {
      item = items[i] || {};
      title = escapeHtml(item.product_title || item.title || item.name || 'Подарок SweetGift');
      url = escapeHtml(item.product_url || item.product_key || item.url || '#');
      image = escapeHtml(item.product_image || item.image || item.image_url || '');

      html += '<a class="sg-top-detail-card" href="' + url + '" title="' + title + '">' +
        '<div class="sg-top-detail-image">' +
          (image ? '<img loading="lazy" decoding="async" src="' + image + '" alt="' + title + '">' :
            '<span class="sg-top-detail-placeholder" aria-hidden="true">SG</span>') +
        '</div>' +
        '<div class="sg-top-detail-body">' +
          (badge ? '<div class="sg-top-detail-badge">' + escapeHtml(badge) + '</div>' : '') +
          '<div class="sg-top-detail-name">' + title + '</div>' +
        '</div>' +
      '</a>';
    }

    root.innerHTML = html + '</div>';
  }

  function requestData(root, period, targetUrl, attempt) {
    window.SG.core.rpc(
      'get_public_top_lists_page_period',
      { p_period: period },
      function (data) {
        render(root, findList(data, targetUrl), period, targetUrl);
      },
      function (error) {
        if (attempt === 0) {
          setTimeout(function () {
            requestData(root, period, targetUrl, 1);
          }, 1000);
          return;
        }

        console.error('[SG Top Pages] RPC error:', error);
        root.innerHTML = renderHeader(root, period) +
          '<div class="sg-top-detail-error">' + ERROR_MESSAGE + '</div>';
      }
    );
  }

  function loadOne(root) {
    var period;
    var targetUrl;

    if (root.getAttribute(READY_ATTRIBUTE) === '1') return;

    if (!window.SG.core || typeof window.SG.core.rpc !== 'function' ||
        typeof window.SG.core.escapeHtml !== 'function') {
      if (root.getAttribute(WAITING_ATTRIBUTE) !== '1') {
        root.setAttribute(WAITING_ATTRIBUTE, '1');
        setTimeout(function () {
          root.removeAttribute(WAITING_ATTRIBUTE);
          loadOne(root);
        }, 300);
      }
      return;
    }

    root.removeAttribute(WAITING_ATTRIBUTE);
    root.setAttribute(READY_ATTRIBUTE, '1');
    period = getPeriodFromUrl();
    targetUrl = root.getAttribute('data-list') || '';
    root.innerHTML = '<div class="sg-top-detail-loading">Загрузка рейтинга...</div>';
    requestData(root, period, targetUrl, 0);
  }

  function init() {
    var roots;
    var i;

    injectCss();
    roots = document.querySelectorAll(ROOT_SELECTOR);

    for (i = 0; i < roots.length; i += 1) {
      loadOne(roots[i]);
    }
  }

  function observe() {
    var observer;

    if (!window.MutationObserver) return;

    observer = new MutationObserver(function () {
      init();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      observe();
    });
  } else {
    init();
    observe();
  }

}());
