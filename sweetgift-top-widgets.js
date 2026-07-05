/*
===========================================================================
SweetGift.ru | Top Widgets
---------------------------------------------------------------------------
Универсальный виджет подборок для категорий, статей и других страниц.

Пример T123:
<div
  class="sg-top-widget"
  data-list="/top/podarochnye-korziny"
  data-title="Популярные подарочные корзины"
  data-subtitle="Корзины, которые чаще всего смотрят и выбирают покупатели SweetGift"
  data-period="week"
  data-limit="6">
</div>
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};

  var VERSION = '1';
  var CSS_ID = 'sg-top-widgets-css';
  var ROOT_SELECTOR = '.sg-top-widget';

  window.SG.topWidgets = {
    version: VERSION
  };

  function escapeHtml(text) {
    if (window.SG.core && typeof window.SG.core.escapeHtml === 'function') {
      return window.SG.core.escapeHtml(text);
    }

    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizePath(path) {
    return String(path || '')
      .replace(window.location.origin, '')
      .split('?')[0]
      .replace(/\/$/, '');
  }

  function toInt(value, fallback) {
    var n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
  }

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;

    var css = `
.sg-top-widget{
  max-width:1180px;
  margin:42px auto 46px;
  padding:0 18px;
  font-family:Arial,sans-serif;
  color:#222;
}

.sg-top-widget *{
  box-sizing:border-box;
}

.sg-top-widget-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:16px;
  margin-bottom:16px;
}

.sg-top-widget-title{
  font-size:28px;
  line-height:1.2;
  margin:0 0 6px;
  font-weight:700;
  color:#222;
}

.sg-top-widget-subtitle{
  font-size:15px;
  line-height:1.45;
  color:#666;
  margin:0;
}

.sg-top-widget-all{
  flex:0 0 auto;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:10px 14px;
  border-radius:999px;
  border:1px solid #eee;
  background:#fff;
  color:#222!important;
  text-decoration:none!important;
  font-size:14px;
}

.sg-top-widget-all:hover{
  border-color:#e60000;
  color:#e60000!important;
}

.sg-top-widget-list{
  display:grid;
  grid-template-columns:repeat(6,minmax(0,1fr));
  gap:14px;
}

.sg-top-widget-card{
  display:block;
  overflow:hidden;
  border:1px solid #eee;
  border-radius:18px;
  background:#fff;
  color:#222!important;
  text-decoration:none!important;
  transition:.2s;
}

.sg-top-widget-card:hover{
  border-color:#e60000;
  box-shadow:0 8px 22px rgba(0,0,0,.06);
}

.sg-top-widget-img{
  width:100%;
  aspect-ratio:1/1;
  background:#f4f4f4;
  overflow:hidden;
}

.sg-top-widget-img img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

.sg-top-widget-body{
  padding:10px;
}

.sg-top-widget-badge{
  display:inline-flex;
  margin-bottom:6px;
  padding:4px 7px;
  border-radius:999px;
  background:#fff5f5;
  color:#e60000;
  font-size:11px;
  line-height:1.2;
  font-weight:700;
}

.sg-top-widget-name{
  font-size:13px;
  line-height:1.3;
  font-weight:600;
  color:#222;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}

.sg-top-widget-empty,
.sg-top-widget-loading{
  padding:18px;
  border-radius:16px;
  background:#fafafa;
  color:#777;
}

@media(max-width:900px){
  .sg-top-widget-list{
    grid-template-columns:repeat(4,minmax(0,1fr));
  }
}

@media(max-width:640px){
  .sg-top-widget{
    margin:34px 0 38px;
    padding:0;
    overflow:hidden;
  }

  .sg-top-widget-head{
    padding:0 14px;
    display:block;
    margin-bottom:14px;
  }

  .sg-top-widget-title{
    font-size:24px;
  }

  .sg-top-widget-subtitle{
    font-size:14px;
  }

  .sg-top-widget-all{
    margin-top:12px;
    width:100%;
  }

  .sg-top-widget-list{
    display:flex;
    gap:10px;
    overflow-x:auto;
    overflow-y:hidden;
    padding:0 14px 10px;
    scroll-snap-type:x proximity;
    -webkit-overflow-scrolling:touch;
  }

  .sg-top-widget-list::-webkit-scrollbar{
    display:none;
  }

  .sg-top-widget-card{
    flex:0 0 calc((100vw - 58px) / 3.25);
    scroll-snap-align:start;
    border-radius:14px;
  }

  .sg-top-widget-body{
    padding:8px 7px 9px;
  }

  .sg-top-widget-badge{
    display:none;
  }

  .sg-top-widget-name{
    font-size:11px;
    line-height:1.25;
    text-align:center;
  }
}
`;

    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function findList(lists, targetUrl) {
    targetUrl = normalizePath(targetUrl);

    return (lists || []).find(function (list) {
      return normalizePath(list.url || '') === targetUrl;
    });
  }

  function render(root, list) {
    var limit = toInt(root.getAttribute('data-limit'), 6);
    var title = root.getAttribute('data-title') || (list && list.title) || 'Популярные товары';
    var subtitle = root.getAttribute('data-subtitle') || (list && list.description) || '';
    var listUrl = root.getAttribute('data-list') || (list && list.url) || '#';
    var badge = root.getAttribute('data-badge') || 'В рейтинге SweetGift';
    var buttonText = root.getAttribute('data-button-text') || 'Смотреть рейтинг';

    if (!list || !list.items || !list.items.length) {
      root.innerHTML = '<div class="sg-top-widget-empty">Подборка пока формируется.</div>';
      return;
    }

    var items = list.items.slice(0, limit);

    var html =
      '<div class="sg-top-widget-head">' +
        '<div>' +
          '<h2 class="sg-top-widget-title">' + escapeHtml(title) + '</h2>' +
          (subtitle ? '<p class="sg-top-widget-subtitle">' + escapeHtml(subtitle) + '</p>' : '') +
        '</div>' +
        '<a class="sg-top-widget-all" href="' + escapeHtml(listUrl) + '">' + escapeHtml(buttonText) + '</a>' +
      '</div>' +
      '<div class="sg-top-widget-list">';

    items.forEach(function (item) {
      var itemTitle = escapeHtml(item.product_title || 'Подарок SweetGift');
      var url = escapeHtml(item.product_key || '#');
      var image = escapeHtml(item.product_image || '');

      html +=
        '<a class="sg-top-widget-card" href="' + url + '" title="' + itemTitle + '">' +
          '<div class="sg-top-widget-img">' +
            (image
              ? '<img loading="lazy" decoding="async" src="' + image + '" alt="' + itemTitle + '" title="' + itemTitle + '">'
              : '') +
          '</div>' +
          '<div class="sg-top-widget-body">' +
            '<div class="sg-top-widget-badge">' + escapeHtml(badge) + '</div>' +
            '<div class="sg-top-widget-name">' + itemTitle + '</div>' +
          '</div>' +
        '</a>';
    });

    html += '</div>';

    root.innerHTML = html;
  }

  function loadOne(root) {
    if (root.getAttribute('data-sg-top-widget-ready') === '1') return;

    if (!window.SG || !window.SG.core || typeof window.SG.core.rpc !== 'function') {
      setTimeout(function () {
        loadOne(root);
      }, 300);
      return;
    }

    root.setAttribute('data-sg-top-widget-ready', '1');

    var listUrl = root.getAttribute('data-list') || '/top/podarochnye-korziny';
    var period = root.getAttribute('data-period') || 'week';

    root.innerHTML = '<div class="sg-top-widget-loading">Загрузка подборки...</div>';

    window.SG.core.rpc(
      'get_public_top_lists_page_period',
      { p_period: period },
      function (data) {
        render(root, findList(data || [], listUrl));
      },
      function (error) {
        console.log('[SG Top Widget]', error);
        root.removeAttribute('data-sg-top-widget-ready');
        root.innerHTML = '<div class="sg-top-widget-empty">Ошибка загрузки подборки.</div>';
      }
    );
  }

  function init() {
    injectCss();

    document.querySelectorAll(ROOT_SELECTOR).forEach(loadOne);
  }

  function observe() {
    if (!window.MutationObserver) return;

    var observer = new MutationObserver(function () {
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

})();