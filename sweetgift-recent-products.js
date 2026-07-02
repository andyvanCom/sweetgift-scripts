/*
===========================================================================
SweetGift.ru | Recent Products
---------------------------------------------------------------------------
Блок "Вы недавно смотрели" на карточках товара.
Хранит историю в localStorage, без запросов к Supabase.
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};

  var STORAGE_KEY = 'sg_recent_products_v1';
  var CSS_ID = 'sg-recent-products-css';
  var MAX_STORE = 20;
  var MAX_SHOW = 4;

  function isProductPage() {
    if (window.SG.core && typeof SG.core.isProductPage === 'function') {
      return SG.core.isProductPage();
    }

    return window.location.pathname.indexOf('/tproduct/') !== -1;
  }

  function escapeHtml(text) {
    if (window.SG.core && typeof SG.core.escapeHtml === 'function') {
      return SG.core.escapeHtml(text);
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
      return String(url || '').split('?')[0].replace(/\/$/, '');
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

      if (img) image = img.getAttribute('data-original') || img.src || '';
    }

    if (!image) {
      var bg = document.querySelector('.t-slds__bgimg, .t-bgimg');
      if (bg) image = bg.getAttribute('data-original') || '';
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
  margin:18px 0 24px;
  max-width:420px;
  font-family:Arial,sans-serif;
}

.sg-recent-products-title{
  font-size:15px;
  font-weight:700;
  margin:0 0 10px;
  color:#222;
}

.sg-recent-products-list{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:8px;
}

.sg-recent-product{
  display:block;
  text-decoration:none!important;
  color:#222!important;
}

.sg-recent-product-img{
  width:100%;
  aspect-ratio:1/1;
  border-radius:10px;
  overflow:hidden;
  background:#f4f4f4;
  border:1px solid #eee;
}

.sg-recent-product-img img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

.sg-recent-product-name{
  margin-top:5px;
  font-size:11px;
  line-height:1.25;
  color:#555;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}

.sg-recent-product:hover .sg-recent-product-img{
  border-color:#e60000;
}

@media(max-width:640px){
  .sg-recent-products{
    max-width:none;
    margin:18px 0 24px;
  }

  .sg-recent-products-list{
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:7px;
  }

  .sg-recent-product-name{
    font-size:10px;
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

  function renderInto(box) {
    var items = getRecentForRender();

    if (!items.length) {
      box.innerHTML = '';
      box.style.display = 'none';
      return;
    }

    box.style.display = '';

    var html = '<div class="sg-recent-products-title">Вы недавно смотрели</div>';
    html += '<div class="sg-recent-products-list">';

    items.forEach(function (item) {
      html +=
        '<a class="sg-recent-product" href="' + escapeHtml(item.url || item.key) + '">' +
          '<div class="sg-recent-product-img">' +
            (item.image ? '<img src="' + escapeHtml(item.image) + '" alt="">' : '') +
          '</div>' +
          '<div class="sg-recent-product-name">' + escapeHtml(item.title) + '</div>' +
        '</a>';
    });

    html += '</div>';

    box.innerHTML = html;
  }

  function findPlace() {
    return (
      document.querySelector('.t-store__product-snippet .t-store__prod-popup__slider') ||
      document.querySelector('.t-store__product-snippet .t-slds') ||
      document.querySelector('.t-store__product-snippet .t-store__prod-popup__gallery') ||
      document.querySelector('.t-store__product-snippet')
    );
  }

  function render() {
    if (!isProductPage()) return;

    injectCss();

    var existing = document.querySelector('.sg-recent-products');

    if (!existing) {
      var place = findPlace();
      if (!place) return;

      existing = document.createElement('div');
      existing.className = 'sg-recent-products';

      place.insertAdjacentElement('afterend', existing);
    }

    renderInto(existing);
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