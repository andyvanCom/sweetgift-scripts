/*
===========================================================================
SweetGift.ru | Top Detail Pages
---------------------------------------------------------------------------
Универсальный модуль для детальных страниц рейтингов /top/*.
Работает через SweetGift Core: SG.core.rpc().

Пример T123:
<div
  class="sg-top-detail"
  data-list="/top/populyarnye-podarki"
  data-title="Популярные подарки SweetGift"
  data-subtitle="Подборка подарков, которые чаще всего привлекают внимание покупателей SweetGift."
  data-badge="Популярный подарок">
</div>
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};

  var MODULE = 'SG Top Pages';
  var CSS_ID = 'sg-top-pages-css';
  var VERSION = '1';

  window.SG.topPages = window.SG.topPages || {};
  window.SG.topPages.version = VERSION;

  var DEFAULTS = {
    period: 'week',
    title: 'Рейтинг подарков SweetGift',
    subtitle: 'Подборка популярных подарков на основе интереса покупателей SweetGift.',
    badge: 'В подборке SweetGift',
    backUrl: '/top',
    backText: '← Все рейтинги SweetGift',
    limit: 100,
    showPeriods: true
  };

  var PERIOD_NAMES = {
    today: 'сегодня',
    yesterday: 'вчера',
    week: 'за неделю',
    month: 'за месяц',
    quarter: 'за квартал'
  };

  var PERIODS = [
    { key: 'today', label: 'Сегодня' },
    { key: 'yesterday', label: 'Вчера' },
    { key: 'week', label: 'Неделя' },
    { key: 'month', label: 'Месяц' },
    { key: 'quarter', label: 'Квартал' }
  ];

  function core() {
    return window.SG && window.SG.core ? window.SG.core : null;
  }

  function log() {
    if (window.SG && window.SG.debug) {
      console.log.apply(console, ['[' + MODULE + ']'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function escapeHtml(text) {
    if (core() && typeof core().escapeHtml === 'function') {
      return core().escapeHtml(text);
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
.sg-top-detail{
  max-width:1180px;
  margin:40px auto 70px;
  padding:0 18px;
  font-family:Arial,sans-serif;
  color:#222;
}
.sg-top-detail *{box-sizing:border-box;}
.sg-top-back{
  display:inline-flex;
  margin-bottom:18px;
  color:#777!important;
  text-decoration:none!important;
  font-size:14px;
}
.sg-top-back:hover{color:#e60000!important;}
.sg-top-detail h1{
  font-size:42px;
  line-height:1.1;
  margin:0 0 12px;
}
.sg-top-detail-subtitle{
  max-width:820px;
  font-size:18px;
  line-height:1.55;
  color:#666;
  margin:0 0 22px;
}
.sg-top-period-tabs{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin:0 0 10px;
}
.sg-top-period-tabs button{
  border:1px solid #eee;
  background:#fafafa;
  border-radius:999px;
  padding:9px 14px;
  font-size:14px;
  cursor:pointer;
  color:#555;
}
.sg-top-period-tabs button.is-active{
  background:#e60000;
  border-color:#e60000;
  color:#fff;
}
.sg-top-detail-info{
  margin:0 0 28px;
  font-size:14px;
  color:#777;
}
.sg-top-detail-info b{color:#222;}
.sg-top-detail-list{min-height:80px;}
.sg-top-detail-grid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:16px;
}
.sg-top-detail-card{
  display:block;
  overflow:hidden;
  border:1px solid #eee;
  border-radius:20px;
  background:#fff;
  text-decoration:none!important;
  color:#222!important;
  transition:.2s;
}
.sg-top-detail-card:hover{
  border-color:#e60000;
  box-shadow:0 8px 22px rgba(0,0,0,.06);
}
.sg-top-detail-img{
  position:relative;
  width:100%;
  aspect-ratio:1/1;
  background:#f4f4f4;
  overflow:hidden;
}
.sg-top-detail-img img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}
.sg-top-detail-rank{
  position:absolute;
  left:10px;
  top:10px;
  padding:6px 10px;
  border-radius:999px;
  background:#e60000;
  color:#fff;
  font-size:13px;
  font-weight:700;
}
.sg-top-detail-body{padding:13px;}
.sg-top-detail-badge{
  display:inline-flex;
  margin-bottom:7px;
  padding:5px 8px;
  border-radius:999px;
  background:#fff5f5;
  color:#e60000;
  font-size:12px;
  font-weight:700;
}
.sg-top-detail-title{
  font-size:15px;
  line-height:1.35;
  font-weight:600;
}
.sg-top-empty,
.sg-top-loading{
  padding:22px;
  border-radius:18px;
  background:#fafafa;
  color:#777;
}
@media(max-width:900px){
  .sg-top-detail-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
}
@media(max-width:640px){
  .sg-top-detail{
    margin:28px auto 50px;
    padding:0 14px;
  }
  .sg-top-detail h1{font-size:30px;}
  .sg-top-detail-subtitle{
    font-size:16px;
    margin-bottom:20px;
  }
  .sg-top-period-tabs{
    display:grid;
    grid-template-columns:repeat(2,1fr);
    gap:7px;
  }
  .sg-top-period-tabs button{
    width:100%;
    padding:10px;
  }
  .sg-top-detail-info{
    font-size:13px;
    margin-bottom:22px;
  }
  .sg-top-detail-grid{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:10px;
  }
  .sg-top-detail-card{border-radius:14px;}
  .sg-top-detail-body{padding:10px;}
  .sg-top-detail-title{font-size:13px;}
}
`;

    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function readConfig(root) {
    return {
      list: normalizePath(root.getAttribute('data-list') || window.location.pathname),
      title: root.getAttribute('data-title') || DEFAULTS.title,
      subtitle: root.getAttribute('data-subtitle') || DEFAULTS.subtitle,
      badge: root.getAttribute('data-badge') || DEFAULTS.badge,
      period: root.getAttribute('data-period') || DEFAULTS.period,
      backUrl: root.getAttribute('data-back-url') || DEFAULTS.backUrl,
      backText: root.getAttribute('data-back-text') || DEFAULTS.backText,
      limit: toInt(root.getAttribute('data-limit'), DEFAULTS.limit),
      showPeriods: root.getAttribute('data-show-periods') !== '0'
    };
  }

  function baseMarkup(config) {
    var buttons = '';

    if (config.showPeriods) {
      buttons = '<div class="sg-top-period-tabs">' + PERIODS.map(function (p) {
        return '<button type="button" data-period="' + escapeHtml(p.key) + '"' +
          (p.key === config.period ? ' class="is-active"' : '') + '>' +
          escapeHtml(p.label) +
          '</button>';
      }).join('') + '</div>';
    }

    return '' +
      '<a class="sg-top-back" href="' + escapeHtml(config.backUrl) + '">' + escapeHtml(config.backText) + '</a>' +
      '<h1>' + escapeHtml(config.title) + '</h1>' +
      '<p class="sg-top-detail-subtitle">' + escapeHtml(config.subtitle) + '</p>' +
      buttons +
      '<div class="sg-top-detail-info"></div>' +
      '<div class="sg-top-detail-list"><div class="sg-top-loading">Загрузка...</div></div>';
  }

  function renderInfo(root, config) {
    var box = root.querySelector('.sg-top-detail-info');
    if (!box) return;

    box.innerHTML = 'Показываем рейтинг <b>' + escapeHtml(PERIOD_NAMES[config.period] || '') + '</b>. Обновления раз в час.';
  }

  function findTargetList(lists, config) {
    if (!lists || !lists.length) return null;

    var target = normalizePath(config.list);

    return lists.find(function (list) {
      return normalizePath(list.url || '') === target;
    }) || null;
  }

  function renderJsonLd(items, config) {
    if (!items || !items.length) return '';

    var data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: config.title,
      itemListElement: items.map(function (item, index) {
        return {
          '@type': 'ListItem',
          position: index + 1,
          url: window.location.origin + item.product_key,
          name: item.product_title || 'Подарок SweetGift'
        };
      })
    };

    return '<script type="application/ld+json">' +
      JSON.stringify(data).replace(/</g, '\\u003c') +
      '<\/script>';
  }

  function renderList(root, list, config) {
    var box = root.querySelector('.sg-top-detail-list');
    if (!box) return;

    if (!list || !list.items || !list.items.length) {
      box.innerHTML = '<div class="sg-top-empty">За выбранный период рейтинг пока формируется.</div>';
      return;
    }

    var items = list.items.slice(0, config.limit);
    var html = '<div class="sg-top-detail-grid">';

    items.forEach(function (item, index) {
      var title = escapeHtml(item.product_title || 'Подарок SweetGift');
      var url = escapeHtml(item.product_key || '#');
      var image = escapeHtml(item.product_image || '');

      html += '' +
        '<a class="sg-top-detail-card" href="' + url + '" title="' + title + '">' +
          '<div class="sg-top-detail-img">' +
            (image
              ? '<img loading="lazy" decoding="async" src="' + image + '" alt="' + title + '" title="' + title + '">'
              : '') +
            '<div class="sg-top-detail-rank">№' + (index + 1) + '</div>' +
          '</div>' +
          '<div class="sg-top-detail-body">' +
            '<div class="sg-top-detail-badge">' + escapeHtml(config.badge) + '</div>' +
            '<div class="sg-top-detail-title">' + title + '</div>' +
          '</div>' +
        '</a>';
    });

    html += '</div>';
    html += renderJsonLd(items, config);

    box.innerHTML = html;
  }

  function loadData(root, config) {
    if (root.getAttribute('data-loading') === '1') return;

    var box = root.querySelector('.sg-top-detail-list');
    if (!box) return;

    root.setAttribute('data-loading', '1');
    box.innerHTML = '<div class="sg-top-loading">Загрузка...</div>';
    renderInfo(root, config);

    if (!core() || typeof core().rpc !== 'function') {
      root.setAttribute('data-loading', '0');
      box.innerHTML = '<div class="sg-top-empty">Ошибка загрузки рейтинга.</div>';
      return;
    }

    core().rpc(
      'get_public_top_lists_page_period',
      { p_period: config.period },
      function (data) {
        root.setAttribute('data-loading', '0');
        renderList(root, findTargetList(data || [], config), config);
      },
      function (error) {
        root.setAttribute('data-loading', '0');
        log('RPC error', error);
        box.innerHTML = '<div class="sg-top-empty">Ошибка загрузки рейтинга.</div>';
      }
    );
  }

  function bindEvents(root, config) {
    root.querySelectorAll('.sg-top-period-tabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        config.period = btn.getAttribute('data-period') || DEFAULTS.period;
        root.setAttribute('data-period', config.period);

        root.querySelectorAll('.sg-top-period-tabs button').forEach(function (b) {
          b.classList.remove('is-active');
        });

        btn.classList.add('is-active');
        loadData(root, config);
      });
    });
  }

  function initOne(root) {
    if (!root || root.getAttribute('data-sg-top-pages-ready') === '1') return;

    var config = readConfig(root);

    if (!config.list) return;

    root.setAttribute('data-sg-top-pages-ready', '1');
    root.innerHTML = baseMarkup(config);

    bindEvents(root, config);
    loadData(root, config);
  }

  function init() {
    injectCss();
    document.querySelectorAll('.sg-top-detail[data-list]').forEach(initOne);
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