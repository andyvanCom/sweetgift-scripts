/*
===========================================================================
SweetGift.ru | Product SEO Blocks
---------------------------------------------------------------------------
Универсальные SEO-блоки в карточке товара.
Данные берутся из get_product_card_seo_blocks_cached.
Работает только на страницах /tproduct/.
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};

  var VERSION = '1';
  var CSS_ID = 'sg-product-seo-blocks-css';
  var ROOT_SELECTOR = '.sg-product-seo-blocks';

  window.SG.productSeoBlocks = {
    version: VERSION
  };

  function isProductPage() {
    return window.location.pathname.indexOf('/tproduct/') !== -1;
  }

  function getProductKey() {
    return window.location.pathname.replace(/\/$/, '');
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

  function formatPrice(price) {
    var n = Number(price || 0);
    if (!n) return '';
    return n.toLocaleString('ru-RU') + ' ₽';
  }

  function hasItems(items) {
    return Array.isArray(items) && items.length > 0;
  }

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;

    var css = `
.sg-product-seo-blocks{
  max-width:1180px;
  margin:42px auto 54px;
  padding:0 18px;
  font-family:Arial,sans-serif;
  color:#222;
}

.sg-product-seo-blocks *{
  box-sizing:border-box;
}

.sg-product-seo-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:18px;
}

.sg-product-seo-section{
  border:1px solid #eee;
  border-radius:22px;
  background:#fff;
  padding:22px;
}

.sg-product-seo-section-full{
  grid-column:1 / -1;
}

.sg-product-seo-title{
  font-size:22px;
  line-height:1.25;
  font-weight:700;
  margin:0 0 16px;
  color:#222;
}

.sg-product-seo-chips{
  display:flex;
  flex-wrap:wrap;
  gap:9px;
}

.sg-product-seo-chip{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:9px 13px;
  border-radius:999px;
  border:1px solid #eee;
  background:#fff;
  color:#222!important;
  text-decoration:none!important;
  font-size:14px;
  line-height:1.2;
}

.sg-product-seo-chip:hover{
  border-color:#e60000;
  color:#e60000!important;
  background:#fff5f5;
}

.sg-product-seo-links{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.sg-product-seo-link{
  display:block;
  color:#222!important;
  text-decoration:none!important;
  font-size:15px;
  line-height:1.35;
  padding-left:18px;
  position:relative;
}

.sg-product-seo-link:before{
  content:"";
  width:6px;
  height:6px;
  border-radius:50%;
  background:#e60000;
  position:absolute;
  left:0;
  top:.55em;
}

.sg-product-seo-link:hover{
  color:#e60000!important;
}

.sg-product-seo-products{
  display:grid;
  grid-template-columns:repeat(6,minmax(0,1fr));
  gap:14px;
}

.sg-product-seo-product{
  display:block;
  overflow:hidden;
  border:1px solid #eee;
  border-radius:18px;
  background:#fff;
  color:#222!important;
  text-decoration:none!important;
  transition:.2s;
}

.sg-product-seo-product:hover{
  border-color:#e60000;
  box-shadow:0 8px 22px rgba(0,0,0,.06);
}

.sg-product-seo-product-img{
  width:100%;
  aspect-ratio:1/1;
  background:#f4f4f4;
  overflow:hidden;
}

.sg-product-seo-product-img img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

.sg-product-seo-product-body{
  padding:10px;
}

.sg-product-seo-product-name{
  font-size:13px;
  line-height:1.3;
  font-weight:600;
  color:#222;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}

.sg-product-seo-product-price{
  margin-top:6px;
  font-size:13px;
  line-height:1.2;
  font-weight:700;
  color:#e60000;
}

@media(max-width:980px){
  .sg-product-seo-grid{
    grid-template-columns:1fr;
  }

  .sg-product-seo-products{
    grid-template-columns:repeat(3,minmax(0,1fr));
  }
}

@media(max-width:640px){
  .sg-product-seo-blocks{
    margin:34px 0 42px;
    padding:0;
    overflow:hidden;
  }

  .sg-product-seo-grid{
    display:block;
  }

  .sg-product-seo-section{
    margin:0 14px 14px;
    padding:18px;
    border-radius:18px;
  }

  .sg-product-seo-title{
    font-size:20px;
  }

  .sg-product-seo-products{
    display:flex;
    gap:10px;
    overflow-x:auto;
    overflow-y:hidden;
    padding:0 14px 8px;
    scroll-snap-type:x proximity;
    -webkit-overflow-scrolling:touch;
  }

  .sg-product-seo-products::-webkit-scrollbar{
    display:none;
  }

  .sg-product-seo-product{
    flex:0 0 calc((100vw - 58px) / 2.35);
    scroll-snap-align:start;
    border-radius:15px;
  }

  .sg-product-seo-section-full{
    margin-left:0;
    margin-right:0;
    border-left:0;
    border-right:0;
    border-radius:0;
    padding-left:14px;
    padding-right:14px;
  }

  .sg-product-seo-product-body{
    padding:8px;
  }

  .sg-product-seo-product-name,
  .sg-product-seo-product-price{
    font-size:12px;
    text-align:center;
  }
}
`;

    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function renderChips(block) {
    if (!hasItems(block.items)) return '';

    var html =
      '<section class="sg-product-seo-section">' +
        '<h2 class="sg-product-seo-title">' + escapeHtml(block.title || 'Подборки') + '</h2>' +
        '<div class="sg-product-seo-chips">';

    block.items.forEach(function (item) {
      html +=
        '<a class="sg-product-seo-chip" href="' + escapeHtml(item.url || '#') + '">' +
          escapeHtml(item.title || 'Подборка') +
        '</a>';
    });

    html += '</div></section>';

    return html;
  }

  function renderLinks(block) {
    if (!hasItems(block.items)) return '';

    var html =
      '<section class="sg-product-seo-section">' +
        '<h2 class="sg-product-seo-title">' + escapeHtml(block.title || 'Читайте также') + '</h2>' +
        '<div class="sg-product-seo-links">';

    block.items.forEach(function (item) {
      html +=
        '<a class="sg-product-seo-link" href="' + escapeHtml(item.url || '#') + '">' +
          escapeHtml(item.title || 'Статья SweetGift') +
        '</a>';
    });

    html += '</div></section>';

    return html;
  }

  function renderProducts(block) {
    if (!hasItems(block.items)) return '';

    var html =
      '<section class="sg-product-seo-section sg-product-seo-section-full">' +
        '<h2 class="sg-product-seo-title">' + escapeHtml(block.title || 'Похожие товары') + '</h2>' +
        '<div class="sg-product-seo-products">';

    block.items.forEach(function (item) {
      var title = escapeHtml(item.title || 'Подарок SweetGift');
      var url = escapeHtml(item.url || '#');
      var image = escapeHtml(item.image || '');
      var price = formatPrice(item.price);

      html +=
        '<a class="sg-product-seo-product" href="' + url + '" title="' + title + '">' +
          '<div class="sg-product-seo-product-img">' +
            (image ? '<img loading="lazy" decoding="async" src="' + image + '" alt="' + title + '">' : '') +
          '</div>' +
          '<div class="sg-product-seo-product-body">' +
            '<div class="sg-product-seo-product-name">' + title + '</div>' +
            (price ? '<div class="sg-product-seo-product-price">' + escapeHtml(price) + '</div>' : '') +
          '</div>' +
        '</a>';
    });

    html += '</div></section>';

    return html;
  }

  function renderBlock(block) {
    if (!block || !block.type) return '';

    if (block.type === 'chips') return renderChips(block);
    if (block.type === 'links') return renderLinks(block);
    if (block.type === 'products') return renderProducts(block);

    return '';
  }

  function render(root, data) {
    var blocks = data && Array.isArray(data.blocks) ? data.blocks : [];

    var html = '<div class="sg-product-seo-grid">';

    blocks.forEach(function (block) {
      html += renderBlock(block);
    });

    html += '</div>';

    if (html.replace(/<[^>]*>/g, '').trim() === '') {
      root.innerHTML = '';
      return;
    }

    root.innerHTML = html;
  }

  function loadOne(root) {
    if (root.getAttribute('data-sg-product-seo-ready') === '1') return;
    if (!isProductPage()) return;

    if (!window.SG || !window.SG.core || typeof window.SG.core.rpc !== 'function') {
      setTimeout(function () {
        loadOne(root);
      }, 300);
      return;
    }

    root.setAttribute('data-sg-product-seo-ready', '1');

    var productKey = root.getAttribute('data-product-key') || getProductKey();

    window.SG.core.rpc(
      'get_product_card_seo_blocks_cached',
      {
        p_product_key: productKey
      },
      function (data) {
        render(root, data || {});
      },
      function (error) {
        console.log('[SG Product SEO Blocks]', error);
        root.removeAttribute('data-sg-product-seo-ready');
        root.innerHTML = '';
      }
    );
  }

  function init() {
    if (!isProductPage()) return;

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