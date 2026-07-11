/*
===========================================================================
SweetGift.ru | Top Articles
---------------------------------------------------------------------------
Страница популярных статей /top/articles
Периоды: сегодня, вчера, неделя, месяц, квартал
Виды: список / карточки
Просмотры пользователю не показываются.
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};

  var VERSION = '3';
  var CSS_ID = 'sg-top-articles-css';
  var ROOT_SELECTOR = '.sg-top-articles';

  window.SG.topArticles = {
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

  function getPeriodFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var period = params.get('period') || 'week';

    return ['today', 'yesterday', 'week', 'month', 'quarter'].indexOf(period) >= 0
      ? period
      : 'week';
  }

  function getView(root) {
    var params = new URLSearchParams(window.location.search);
    var view = params.get('view');

    if (view === 'cards') return 'cards';
    if (view === 'list') return 'list';

    return root.getAttribute('data-default-view') === 'cards' ? 'cards' : 'list';
  }

  function allowViewSwitch(root) {
    return root.getAttribute('data-allow-view-switch') !== '0';
  }

  function buildUrl(period, view) {
    return '?period=' + encodeURIComponent(period) + '&view=' + encodeURIComponent(view);
  }

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;

    var css = `
.sg-top-articles{
  max-width:1180px;
  margin:0 auto 60px;
  padding:0 18px;
  font-family:Arial,sans-serif;
  color:#222;
}

.sg-top-articles *{
  box-sizing:border-box;
}

.sg-top-articles-title{
  font-size:36px;
  line-height:1.15;
  font-weight:700;
  margin:0 0 12px;
}

.sg-top-articles-subtitle{
  max-width:760px;
  font-size:16px;
  line-height:1.5;
  color:#666;
  margin:0 0 24px;
}

.sg-top-articles-controls{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  margin-bottom:24px;
}

.sg-top-articles-tabs,
.sg-top-articles-view{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}

.sg-top-articles-tab,
.sg-top-articles-view-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:10px 15px;
  border-radius:999px;
  border:1px solid #eee;
  background:#fff;
  color:#222!important;
  text-decoration:none!important;
  font-size:14px;
  line-height:1.2;
}

.sg-top-articles-view-btn{
  padding:9px 13px;
  font-size:13px;
}

.sg-top-articles-tab:hover,
.sg-top-articles-tab.is-active,
.sg-top-articles-view-btn:hover,
.sg-top-articles-view-btn.is-active{
  border-color:#e60000;
  color:#e60000!important;
  background:#fff5f5;
}

/* Вид: список */

.sg-top-articles-list{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.sg-top-articles-row{
  display:grid;
  grid-template-columns:1fr auto;
  gap:18px;
  align-items:center;
  padding:18px 20px;
  border:1px solid #eee;
  border-radius:18px;
  background:#fff;
  color:#222!important;
  text-decoration:none!important;
  transition:.2s;
}

.sg-top-articles-row:hover{
  border-color:#e60000;
  box-shadow:0 8px 22px rgba(0,0,0,.06);
}

.sg-top-articles-row-title{
  font-size:18px;
  line-height:1.35;
  font-weight:700;
  color:#222;
}

.sg-top-articles-row-text{
  margin-top:5px;
  font-size:14px;
  line-height:1.45;
  color:#666;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}

.sg-top-articles-row-button{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:10px 16px;
  border-radius:999px;
  background:#e60000;
  color:#fff!important;
  font-size:14px;
  text-decoration:none!important;
  white-space:nowrap;
}

/* Вид: карточки */

.sg-top-articles-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:22px;
}

.sg-top-articles-card{
  display:flex;
  flex-direction:column;
  overflow:hidden;
  border:1px solid #eee;
  border-radius:22px;
  background:#fff;
  color:#222!important;
  text-decoration:none!important;
  transition:.2s;
}

.sg-top-articles-card:hover{
  border-color:#e60000;
  box-shadow:0 10px 26px rgba(0,0,0,.07);
}

.sg-top-articles-img{
  width:100%;
  aspect-ratio:16/10;
  background:#f4f4f4;
  overflow:hidden;
}

.sg-top-articles-img img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

.sg-top-articles-body{
  display:flex;
  flex-direction:column;
  flex:1;
  padding:18px;
}

.sg-top-articles-name{
  font-size:19px;
  line-height:1.25;
  font-weight:700;
  margin:0 0 10px;
}

.sg-top-articles-text{
  font-size:14px;
  line-height:1.45;
  color:#666;
  margin:0 0 16px;
  display:-webkit-box;
  -webkit-line-clamp:3;
  -webkit-box-orient:vertical;
  overflow:hidden;
}

.sg-top-articles-button{
  margin-top:auto;
  display:inline-flex;
  width:max-content;
  align-items:center;
  justify-content:center;
  padding:10px 15px;
  border-radius:999px;
  background:#e60000;
  color:#fff!important;
  font-size:14px;
  text-decoration:none!important;
}

.sg-top-articles-loading,
.sg-top-articles-empty{
  padding:22px;
  border-radius:18px;
  background:#fafafa;
  color:#777;
}

@media(max-width:900px){
  .sg-top-articles-grid{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }

  .sg-top-articles-controls{
    display:block;
  }

  .sg-top-articles-view{
    margin-top:12px;
  }
}

@media(max-width:640px){
  .sg-top-articles{
    padding:0 14px;
  }

  .sg-top-articles-title{
    font-size:28px;
  }

  .sg-top-articles-subtitle{
    font-size:14px;
  }

  .sg-top-articles-tabs,
  .sg-top-articles-view{
    flex-wrap:nowrap;
    overflow-x:auto;
    padding-bottom:6px;
    -webkit-overflow-scrolling:touch;
  }

  .sg-top-articles-tabs::-webkit-scrollbar,
  .sg-top-articles-view::-webkit-scrollbar{
    display:none;
  }

  .sg-top-articles-tab,
  .sg-top-articles-view-btn{
    flex:0 0 auto;
  }

  .sg-top-articles-row{
    display:block;
    padding:15px 16px;
    border-radius:16px;
  }

  .sg-top-articles-row-title{
    font-size:16px;
  }

  .sg-top-articles-row-text{
    font-size:13px;
  }

  .sg-top-articles-row-button{
    margin-top:12px;
    width:100%;
  }

  .sg-top-articles-grid{
    grid-template-columns:1fr;
    gap:16px;
  }

  .sg-top-articles-body{
    padding:15px;
  }

  .sg-top-articles-name{
    font-size:18px;
  }
}
`;

    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function renderControls(period, view, showSwitcher) {
    var tabs = [
      ['today', 'Сегодня'],
      ['yesterday', 'Вчера'],
      ['week', 'Неделя'],
      ['month', 'Месяц'],
      ['quarter', 'Квартал']
    ];

    var html = '<div class="sg-top-articles-controls">';

    html += '<div class="sg-top-articles-tabs">';

    html += tabs.map(function (tab) {
      var code = tab[0];
      var title = tab[1];
      var active = code === period ? ' is-active' : '';

      return '<a class="sg-top-articles-tab' + active + '" href="' + buildUrl(code, view) + '">' +
        escapeHtml(title) +
      '</a>';
    }).join('');

    html += '</div>';

    if (showSwitcher) {
      html +=
        '<div class="sg-top-articles-view">' +
          '<a class="sg-top-articles-view-btn' + (view === 'list' ? ' is-active' : '') + '" href="' + buildUrl(period, 'list') + '">Список</a>' +
          '<a class="sg-top-articles-view-btn' + (view === 'cards' ? ' is-active' : '') + '" href="' + buildUrl(period, 'cards') + '">Карточки</a>' +
        '</div>';
    }

    html += '</div>';

    return html;
  }

  function renderList(items) {
    var html = '<div class="sg-top-articles-list">';

    items.forEach(function (item) {
      var url = escapeHtml(item.url || '#');
      var itemTitle = escapeHtml(item.title || 'Статья SweetGift');
      var description = escapeHtml(item.description || '');

      html +=
        '<a class="sg-top-articles-row" href="' + url + '" title="' + itemTitle + '">' +
          '<div>' +
            '<div class="sg-top-articles-row-title">' + itemTitle + '</div>' +
            (description ? '<div class="sg-top-articles-row-text">' + description + '</div>' : '') +
          '</div>' +
          '<span class="sg-top-articles-row-button">Читать</span>' +
        '</a>';
    });

    html += '</div>';

    return html;
  }

  function renderCards(items) {
    var html = '<div class="sg-top-articles-grid">';

    items.forEach(function (item) {
      var url = escapeHtml(item.url || '#');
      var itemTitle = escapeHtml(item.title || 'Статья SweetGift');
      var description = escapeHtml(item.description || '');
      var image = escapeHtml(item.image || '');

      html +=
        '<a class="sg-top-articles-card" href="' + url + '" title="' + itemTitle + '">' +
          '<div class="sg-top-articles-img">' +
            (image ? '<img loading="lazy" decoding="async" src="' + image + '" alt="' + itemTitle + '">' : '') +
          '</div>' +
          '<div class="sg-top-articles-body">' +
            '<div class="sg-top-articles-name">' + itemTitle + '</div>' +
            (description ? '<p class="sg-top-articles-text">' + description + '</p>' : '') +
            '<span class="sg-top-articles-button">Читать</span>' +
          '</div>' +
        '</a>';
    });

    html += '</div>';

    return html;
  }

  function render(root, items, period, view, showSwitcher) {
    var title = root.getAttribute('data-title') || 'Популярные статьи SweetGift';
    var subtitle = root.getAttribute('data-subtitle') || 'Самые читаемые материалы о подарках, клубнике в шоколаде, фруктовых корзинах и красивых поздравлениях.';

    var html =
      '<h1 class="sg-top-articles-title">' + escapeHtml(title) + '</h1>' +
      '<p class="sg-top-articles-subtitle">' + escapeHtml(subtitle) + '</p>' +
      renderControls(period, view, showSwitcher);

    if (!items || !items.length) {
      root.innerHTML = html + '<div class="sg-top-articles-empty">Популярные статьи пока формируются.</div>';
      return;
    }

    html += view === 'cards'
      ? renderCards(items)
      : renderList(items);

    root.innerHTML = html;
  }

  function loadOne(root) {
    if (root.getAttribute('data-sg-top-articles-ready') === '1') return;

    if (!window.SG || !window.SG.core || typeof window.SG.core.rpc !== 'function') {
      setTimeout(function () {
        loadOne(root);
      }, 300);
      return;
    }

    root.setAttribute('data-sg-top-articles-ready', '1');

    var period = getPeriodFromUrl();
    var view = getView(root);
    var showSwitcher = allowViewSwitch(root);
    var limit = parseInt(root.getAttribute('data-limit') || '30', 10);

    root.innerHTML = '<div class="sg-top-articles-loading">Загрузка популярных статей...</div>';

    window.SG.core.rpc(
      'get_public_top_articles_page_period',
      {
        p_period: period,
        p_limit: limit
      },
      function (data) {
        render(root, data || [], period, view, showSwitcher);
      },
      function (error) {
        console.log('[SG Top Articles]', error);
        root.removeAttribute('data-sg-top-articles-ready');
        root.innerHTML = '<div class="sg-top-articles-empty">Ошибка загрузки популярных статей.</div>';
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