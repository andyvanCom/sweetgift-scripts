/*
===========================================================================
SweetGift.ru | Product Top Lists
---------------------------------------------------------------------------
Заменяет шаблон [SG_TOP_LISTS]...[/SG_TOP_LISTS] в карточке товара
на реальные ТОП-списки из Supabase.
===========================================================================
*/

(function(){
  'use strict';

  var SUPABASE_URL = 'https://rvgvbxipccbkytmhltmi.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_JrPJQVLLpcDxjte5OSCnvg_ocvpBqqT';

  var CONFIG = {
    debug: true,
    retryCount: 12,
    retryDelay: 500
  };

  function log(){
    if(CONFIG.debug){
      console.log.apply(console, ['[SG Top Lists]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function normalizeProductKey(url){
    try{
      return new URL(url, window.location.origin).pathname.replace(/\/$/, '');
    }catch(e){
      return String(url || '').replace(window.location.origin, '').replace(/\/$/, '');
    }
  }

  function getCurrentProductKey(){
    var snippet = document.querySelector('.t-store__product-snippet[data-product-url]');
    var dataUrl = snippet ? snippet.getAttribute('data-product-url') : '';

    if(dataUrl){
      return normalizeProductKey(dataUrl);
    }

    if(window.location.pathname.indexOf('/tproduct/') !== -1){
      return normalizeProductKey(window.location.pathname);
    }

    return '';
  }

  function loadSupabase(callback){
    if(window.supabase){
      callback();
      return;
    }

    var existing = document.querySelector('script[src*="supabase-js"]');

    if(existing){
      var timer = setInterval(function(){
        if(window.supabase){
          clearInterval(timer);
          callback();
        }
      }, 100);

      setTimeout(function(){
        clearInterval(timer);
      }, 7000);

      return;
    }

    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = callback;
    document.head.appendChild(script);
  }

  function injectCss(){
    if(document.getElementById('sg-product-top-lists-css')) return;

    var css = `
.sg-product-top-lists{
  margin:18px 0;
  padding:18px;
  border:1px solid #eeeeee;
  border-radius:18px;
  background:#fafafa;
  font-family:Arial,sans-serif;
  color:#222;
}

.sg-product-top-lists-title{
  margin:0 0 8px;
  font-size:18px;
  line-height:1.3;
  font-weight:700;
}

.sg-product-top-lists-subtitle{
  margin:0 0 14px;
  font-size:14px;
  line-height:1.45;
  color:#666;
}

.sg-product-top-lists-list{
  display:flex;
  flex-direction:column;
  gap:8px;
}

.sg-product-top-list-link{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:12px 13px;
  border:1px solid #eeeeee;
  border-radius:14px;
  background:#fff;
  color:#222 !important;
  text-decoration:none !important;
  transition:.2s ease;
}

.sg-product-top-list-link:hover{
  border-color:#e60000;
  color:#e60000 !important;
}

.sg-product-top-list-main{
  display:flex;
  align-items:center;
  gap:9px;
  min-width:0;
}

.sg-product-top-list-icon{
  flex:0 0 auto;
  font-size:18px;
  line-height:1;
}

.sg-product-top-list-text{
  min-width:0;
  font-size:15px;
  line-height:1.35;
  font-weight:500;
}

.sg-product-top-list-rank{
  flex:0 0 auto;
  padding:4px 8px;
  border-radius:999px;
  background:#fff5f5;
  color:#e60000;
  font-size:12px;
  font-weight:700;
  white-space:nowrap;
}

.sg-product-top-lists-empty{
  padding:14px;
  border-radius:14px;
  background:#fff;
  border:1px solid #eeeeee;
  color:#666;
  font-size:14px;
  line-height:1.45;
}

@media(max-width:640px){
  .sg-product-top-lists{
    margin:16px 0;
    padding:14px;
    border-radius:15px;
  }

  .sg-product-top-lists-title{
    font-size:16px;
  }

  .sg-product-top-lists-subtitle{
    font-size:13px;
  }

  .sg-product-top-list-link{
    align-items:flex-start;
    padding:11px;
    border-radius:12px;
  }

  .sg-product-top-list-text{
    font-size:14px;
  }

  .sg-product-top-list-rank{
    font-size:11px;
  }
}
`;

    var style = document.createElement('style');
    style.id = 'sg-product-top-lists-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function findMarkerElement(){
    var candidates = Array.from(document.querySelectorAll('.t-store__product-snippet *'));

    for(var i = 0; i < candidates.length; i++){
      var el = candidates[i];

      if(el.children && el.children.length > 0) continue;

      var text = el.textContent || '';

      if(text.indexOf('[SG_TOP_LISTS]') !== -1 && text.indexOf('[/SG_TOP_LISTS]') !== -1){
        return el;
      }
    }

    var all = Array.from(document.body.querySelectorAll('*'));

    for(var j = 0; j < all.length; j++){
      var node = all[j];
      var nodeText = node.textContent || '';

      if(nodeText.indexOf('[SG_TOP_LISTS]') !== -1 && nodeText.indexOf('[/SG_TOP_LISTS]') !== -1){
        return node;
      }
    }

    return null;
  }

  function createBlock(items){
    var box = document.createElement('div');
    box.className = 'sg-product-top-lists';

    var html = ''
      + '<div class="sg-product-top-lists-title">🏆 Товар входит в списки SweetGift</div>'
      + '<div class="sg-product-top-lists-subtitle">Подборки формируются на основе интереса покупателей, просмотров, добавлений в корзину и популярности товаров.</div>';

    if(!items || !items.length){
      html += ''
        + '<div class="sg-product-top-lists-empty">'
        + 'Пока этот товар не попал в публичные рейтинги. Данные обновляются по мере накопления статистики.'
        + '</div>';

      box.innerHTML = html;
      return box;
    }

    html += '<div class="sg-product-top-lists-list">';

    items.forEach(function(item){
      html += ''
        + '<a class="sg-product-top-list-link" href="' + item.url + '">'
        + '<span class="sg-product-top-list-main">'
        + '<span class="sg-product-top-list-icon">' + (item.icon || '🏆') + '</span>'
        + '<span class="sg-product-top-list-text">' + item.title + '</span>'
        + '</span>'
        + '<span class="sg-product-top-list-rank">№' + item.rank + '</span>'
        + '</a>';
    });

    html += '</div>';

    box.innerHTML = html;
    return box;
  }

  function replaceMarker(items){
    var marker = findMarkerElement();

    if(!marker){
      log('Marker not found');
      return false;
    }

    injectCss();

    var block = createBlock(items);

    marker.replaceWith(block);

    log('Marker replaced');
    return true;
  }

  function loadProductLists(productKey){
    loadSupabase(function(){
      var sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      sb.rpc('get_product_top_lists', {
        p_product_key: productKey
      }).then(function(res){
        if(res.error){
          console.log('[SG Top Lists] RPC error', res.error);
          replaceMarker([]);
          return;
        }

        replaceMarker(res.data || []);
      });
    });
  }

  function start(){
    var productKey = getCurrentProductKey();

    if(!productKey){
      log('No product key');
      return;
    }

    var attempts = 0;

    function waitMarker(){
      attempts += 1;

      if(findMarkerElement()){
        log('Product key:', productKey);
        loadProductLists(productKey);
        return;
      }

      if(attempts < CONFIG.retryCount){
        setTimeout(waitMarker, CONFIG.retryDelay);
      }else{
        log('Marker not found after retries');
      }
    }

    waitMarker();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  }else{
    start();
  }

  if(window.jQuery){
    jQuery(window).on('tStoreRendered', function(){
      setTimeout(start, 500);
    });
  }

})();