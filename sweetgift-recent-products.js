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
  var VERSION = '6';

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

@media(max-width:640px){
  .sg-recent-products{
    max-width:none;
    margin:28px 0 26px;
    padding:0;
  }

  .sg-recent-products-title{
    font-size:20px;
    margin-bottom:12px;
  }

  .sg-recent-products-list{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:12px;
  }

  .sg-recent-product-img{
    border-radius:12px;
  }

  .sg-recent-product-name{
    font-size:13px;
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