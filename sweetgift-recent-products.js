/*
===========================================================================
SweetGift.ru | Recent Products
---------------------------------------------------------------------------
Блок "Вы недавно смотрели" / "Продолжить просмотр" на карточках товара.
Хранит историю в localStorage, без запросов к Supabase.

Для вывода блока вставить в T123 в нужном месте:
<div class="sg-recent-products"></div>
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};

  var STORAGE_KEY = 'sg_recent_products_v1';
  var CSS_ID = 'sg-recent-products-css';
  var VERSION = '7';

  var MAX_STORE = 20;
  var MAX_SHOW = 4;

  window.SG.recentProducts = window.SG.recentProducts || {};
  window.SG.recentProducts.version = VERSION;

  function isProductPage() {
    if (window.SG.core && typeof window.SG.core.isProductPage === 'function') {
      return window.SG.core.isProductPage();
    }

    return window.location.pathname.indexOf('/tproduct/') !== -1;
  }

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

  function normalizePath(url) {
    try {
      return new URL(url, window.location.origin).pathname.replace(/\/$/, '');
    } catch (e) {
      return String(url || '')
        .replace(window.location.origin, '')
        .split('?')[0]
        .replace(/\/$/, '');
    }
  }

  function readList() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_STORE)));
    } catch (e) {}
  }

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function getCurrentProduct() {
    var key = normalizePath(window.location.pathname);

    var title = cleanText(
      (document.querySelector('h1') || {}).innerText ||
      (document.querySelector('.js-store-prod-name') || {}).innerText ||
      document.title ||
      ''
    );

    var image = '';

    var og = document.querySelector('meta[property="og:image"]');
    if (og && og.content) image = og.content;

    if (!image) {
      var img =
        document.querySelector('.t-store__product-snippet img') ||
        document.querySelector('.t-slds__bgimg img') ||
        document.querySelector('.t-store__prod-popup__slider img');

      if (img) {
        image = img.getAttribute('data-original') || img.src || '';
      }
    }

    if (!image) {
      var bg = document.querySelector('.t-slds__bgimg, .t-bgimg');
      if (bg) {
        image = bg.getAttribute('data-original') || '';
      }
    }

    return {
      key: key,
      url: key,
      title: title,
      image: image,
      time: Date.now()
    };
  }

  function rememberCurrentProduct() {
    if (!isProductPage()) return;

    var item = getCurrentProduct();

    if (!item.key || !item.title) return;

    var list = readList().filter(function (x) {
      return x && x.key !== item.key;
    });

    list.unshift(item);
    saveList(list);
  }

 function injectCss() {
  if (document.getElementById(CSS_ID)) return;

  var css = `
.sg-recent-products{
  max-width:1180px;
  margin:36px auto 34px;
  padding:0 18px;
  font-family:Arial,sans-serif;
  clear:both;
}

.sg-recent-products-title{
  font-size:22px;
  line-height:1.25;
  font-weight:700;
  margin:0 0 14px;
  color:#222;
}

.sg-recent-products-list{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:14px;
}

.sg-recent-product{
  display:block;
  text-decoration:none!important;
  color:#222!important;
}

.sg-recent-product-img{
  width:100%;
  aspect-ratio:1/1;
  border-radius:14px;
  overflow:hidden;
  background:#f4f4f4;
  border:1px solid #eee;
  transition:.2s;
}

.sg-recent-product-img img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

.sg-recent-product-name{
  margin-top:8px;
  font-size:14px;
  line-height:1.3;
  color:#555;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}

.sg-recent-product:hover .sg-recent-product-img{
  border-color:#e60000;
  box-shadow:0 8px 22px rgba(0,0,0,.06);
}

.sg-recent-product:hover .sg-recent-product-name{
  color:#e60000;
}

.sg-recent-products-hint{
  display:none;
}

@media(max-width:640px){
  .sg-recent-products{
    max-width:none;
    margin:24px 0 24px;
    padding:0;
    overflow:hidden;
  }

  .sg-recent-products-title{
    font-size:20px;
    margin-bottom:6px;
  }

  .sg-recent-products-hint{
    display:flex;
    align-items:center;
    gap:6px;
    margin:0 0 10px;
    font-size:12px;
    line-height:1.2;
    color:#999;
    animation:sgRecentHintFade 5s forwards;
  }

  .sg-recent-products-hint svg{
    width:18px;
    height:24px;
    flex:0 0 auto;
    animation:sgRecentHandMove 1.5s ease-in-out infinite;
  }

  .sg-recent-products-list{
    display:flex;
    gap:10px;
    overflow-x:auto;
    overflow-y:hidden;
    scroll-snap-type:x proximity;
    -webkit-overflow-scrolling:touch;
    padding:0 2px 6px;
  }

  .sg-recent-products-list::-webkit-scrollbar{
    display:none;
  }

  .sg-recent-product{
    flex:0 0 82px;
    width:82px;
    scroll-snap-align:start;
  }

  .sg-recent-product-img{
    width:78px;
    height:78px;
    aspect-ratio:auto;
    border-radius:11px;
    margin:0 auto;
  }

  .sg-recent-product-name{
    margin-top:5px;
    font-size:10px;
    line-height:1.25;
    text-align:center;
  }

  @keyframes sgRecentHandMove{
    0%{transform:translateX(0);}
    50%{transform:translateX(12px);}
    100%{transform:translateX(0);}
  }

  @keyframes sgRecentHintFade{
    0%{opacity:1;}
    80%{opacity:1;}
    100%{opacity:0;}
  }
}
`;

  var style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = css;
  document.head.appendChild(style);
}
  function getRecentForRender() {
    var currentKey = normalizePath(window.location.pathname);

    return readList()
      .filter(function (item) {
        return item && item.key && item.key !== currentKey && item.title;
      })
      .slice(0, MAX_SHOW);
  }

  function renderJsonLd(items) {
    if (!items.length) return '';

    var data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: items.map(function (item, index) {
        return {
          '@type': 'ListItem',
          position: index + 1,
          url: window.location.origin + (item.url || item.key),
          name: item.title || ''
        };
      })
    };

    return '<script type="application/ld+json">' +
      JSON.stringify(data).replace(/</g, '\\u003c') +
      '<\/script>';
  }

  function renderInto(box) {
    var items = getRecentForRender();

    if (!items.length) {
      box.innerHTML = '';
      box.style.display = 'none';
      return;
    }

    box.style.display = '';

    var html = '<h3 class="sg-recent-products-title">Продолжить просмотр</h3>';
    html += '<div class="sg-recent-products-hint">' +
  '<svg viewBox="0 0 237 286" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M78.9579 285.7C78.9579 285.7 37.8579 212.5 20.5579 180.8C-2.44209 138.6 -6.2422 120.8 9.6579 112C19.5579 106.5 33.2579 108.8 41.6579 123.4L61.2579 154.6V32.3C61.2579 32.3 60.0579 0 83.0579 0C107.558 0 105.458 32.3 105.458 32.3V91.7C105.458 91.7 118.358 82.4 133.458 86.6C141.158 88.7 150.158 92.4 154.958 104.6C154.958 104.6 185.658 89.7 200.958 121.4C200.958 121.4 236.358 114.4 236.358 151.1C236.358 187.8 192.158 285.7 192.158 285.7H78.9579Z" fill="rgba(190,190,190,1)"></path>' +
  '</svg>' +
  '<span>Листайте товары</span>' +
'</div>';
    html += '<div class="sg-recent-products-list">';

    items.forEach(function (item) {
      var title = escapeHtml(item.title || '');
      var url = escapeHtml(item.url || item.key || '');
      var image = escapeHtml(item.image || '');

      html +=
        '<a class="sg-recent-product" href="' + url + '" title="' + title + '">' +
          '<div class="sg-recent-product-img">' +
            (image
              ? '<img loading="lazy" decoding="async" src="' + image + '" alt="' + title + '" title="' + title + '">'
              : '') +
          '</div>' +
          '<div class="sg-recent-product-name">' + title + '</div>' +
        '</a>';
    });

    html += '</div>';
    html += renderJsonLd(items);

    box.innerHTML = html;
  }

  function render() {
    if (!isProductPage()) return;

    injectCss();

    var boxes = Array.from(document.querySelectorAll('.sg-recent-products'));

    if (!boxes.length) return;

    boxes.forEach(function (box) {
      renderInto(box);
    });
  }

  function init() {
    if (!isProductPage()) return;

    render();

    setTimeout(function () {
      rememberCurrentProduct();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();