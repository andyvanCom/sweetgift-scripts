/*
===========================================================================
SweetGift.ru | Product Analytics v5
---------------------------------------------------------------------------
✓ просмотры товаров
✓ купить в листинге
✓ купить в карточке
✓ избранное
✓ поделиться: нативное меню на телефоне, выпадающее меню на ПК
===========================================================================
*/

(function(){

  const SUPABASE_URL = 'https://rvgvbxipccbkytmhltmi.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_JrPJQVLLpcDxjte5OSCnvg_ocvpBqqT';

  const SHARE_ICON_URL = 'https://static.tildacdn.com/tild3637-6435-4566-b931-313465363363/share_3882403.png';

  const VIEW_TTL = 30 * 60 * 1000;
  const CLICK_TTL = 3 * 1000;

  function injectCss(){
    if(document.getElementById('sg-product-analytics-css')) return;

    const css = `
.sg-product-share-box{
  position:relative;
  display:flex;
  align-items:center;
  margin:12px 0 14px 0;
  font-family:Arial,sans-serif;
}

.sg-product-share-main{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:9px;
  height:40px;
  padding:0 16px;
  border:1px solid #e8e8e8;
  border-radius:12px;
  background:#fff;
  color:#555;
  font-size:15px;
  font-weight:500;
  cursor:pointer;
  transition:.2s ease;
}

.sg-product-share-main:hover{
  border-color:#e60000;
  color:#e60000;
}

.sg-product-share-icon{
  width:18px;
  height:18px;
  display:block;
  object-fit:contain;
}

.sg-product-share-menu{
  display:none;
  position:absolute;
  left:0;
  top:48px;
  min-width:220px;
  background:#fff;
  border-radius:14px;
  box-shadow:0 10px 30px rgba(0,0,0,.14);
  padding:8px 0;
  z-index:99999;
}

.sg-product-share-box.is-open .sg-product-share-menu{
  display:block;
}

.sg-product-share-menu a{
  display:block;
  padding:11px 16px;
  color:#222;
  text-decoration:none;
  font-size:15px;
}

.sg-product-share-menu a:hover{
  background:#f7f7f7;
  color:#e60000;
}

@media(max-width:640px){
  .sg-product-share-box{
    margin:12px 0 14px 0;
  }

  .sg-product-share-main{
    height:40px;
    padding:0 15px;
    font-size:15px;
  }

  .sg-product-share-menu{
    width:230px;
    max-width:calc(100vw - 50px);
  }
}
`;

    const style = document.createElement('style');
    style.id = 'sg-product-analytics-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function isProductPage(){
    return window.location.pathname.indexOf('/tproduct/') !== -1;
  }

  function cleanText(text){
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function loadSupabase(callback){
    if(window.supabase){
      callback();
      return;
    }

    const existing = document.querySelector('script[src*="supabase-js"]');

    if(existing){
      const timer = setInterval(function(){
        if(window.supabase){
          clearInterval(timer);
          callback();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = callback;
    document.head.appendChild(script);
  }

  function normalizeProductKey(url){
    try{
      const u = new URL(url, window.location.origin);
      return u.pathname.replace(/\/$/, '');
    }catch(e){
      return String(url || '').replace(window.location.origin, '').replace(/\/$/, '');
    }
  }

  function getFingerprint(){
    let fp = localStorage.getItem('sg_product_fp');

    if(!fp){
      fp = 'fp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('sg_product_fp', fp);
    }

    return fp;
  }

  function getCategoryFromUrl(url){
    const key = normalizeProductKey(url || window.location.pathname);
    const parts = key.split('/').filter(Boolean);
    return parts[0] || null;
  }

  function getPageProductKey(){
    return window.location.pathname.replace(/\/$/, '');
  }

  function getProductTitleFromPage(){
    return cleanText(
      document.querySelector('h1')?.innerText ||
      document.querySelector('.js-store-prod-name')?.innerText ||
      document.querySelector('.t-store__prod-popup__name')?.innerText ||
      document.title ||
      ''
    );
  }

  function getProductImageFromPage(){
    let image = '';

    const og = document.querySelector('meta[property="og:image"]');
    if(og && og.content) image = og.content;

    if(!image){
      document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){
        try{
          const json = JSON.parse(s.textContent);

          if(json.image){
            image = Array.isArray(json.image) ? json.image[0] : json.image;
          }

          if(!image && json['@graph']){
            json['@graph'].forEach(function(item){
              if(!image && item.image){
                image = Array.isArray(item.image) ? item.image[0] : item.image;
              }
            });
          }
        }catch(e){}
      });
    }

    if(!image){
      image =
        document.querySelector('.t-store__product-snippet img')?.src ||
        document.querySelector('.t-slds__bgimg')?.getAttribute('data-original') ||
        '';
    }

    return image || null;
  }

  function getProductDataFromCard(card){
    const link =
      card.querySelector('a[href*="/tproduct/"]') ||
      card.querySelector('[href*="/tproduct/"]');

    const productKey = link ? normalizeProductKey(link.href) : null;

    const title = cleanText(
      card.querySelector('.t-store__card__title')?.innerText ||
      card.querySelector('.js-store-prod-name')?.innerText ||
      card.querySelector('.t-name')?.innerText ||
      ''
    );

    let image = '';

    const img = card.querySelector('img');
    if(img){
      image = img.getAttribute('data-original') || img.getAttribute('src') || '';
    }

    if(!image){
      const bg = card.querySelector('.t-store__card__imgwrapper, .t-bgimg, .t-slds__bgimg');
      image = bg?.getAttribute('data-original') || '';
    }

    return {
      productKey: productKey,
      title: title,
      image: image || null,
      category: productKey ? getCategoryFromUrl(productKey) : null
    };
  }

  function getProductDataFromPage(){
    return {
      productKey: getPageProductKey(),
      title: getProductTitleFromPage(),
      image: getProductImageFromPage(),
      category: getCategoryFromUrl(window.location.pathname)
    };
  }

  function canTrack(key, ttl){
    const storageKey = 'sg_track_' + key;
    const last = Number(localStorage.getItem(storageKey) || 0);
    const now = Date.now();

    if(last && now - last < ttl){
      return false;
    }

    localStorage.setItem(storageKey, String(now));
    return true;
  }

  function trackProductEvent(eventType, data, options){
    if(!data || !data.productKey) return;

    const channel = options && options.channel ? options.channel : null;
    const uniqueKey = eventType + '_' + (channel || 'none') + '_' + data.productKey;

    if(eventType === 'view' && !canTrack(uniqueKey, VIEW_TTL)) return;
    if(eventType !== 'view' && !canTrack(uniqueKey, CLICK_TTL)) return;

    loadSupabase(function(){
      const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      sb.rpc('track_product_event', {
        p_product_key: data.productKey,
        p_event_type: eventType,

        p_title: data.title || null,
        p_image: data.image || null,
        p_category: data.category || null,

        p_source: new URLSearchParams(window.location.search).get('utm_source') || null,
        p_channel: channel,

        p_page_url: window.location.href,
        p_referrer: document.referrer || null,
        p_fingerprint: getFingerprint(),

        p_rating: null
      }).then(function(res){
        if(res.error){
          console.log('Product analytics error:', eventType, res.error);
          return;
        }

        console.log('Product analytics tracked:', eventType, channel || '', data.productKey);
      });
    });
  }

  function initProductView(){
    if(!isProductPage()) return;

    trackProductEvent('view', getProductDataFromPage());
  }

  function addShareBlock(){
    if(!isProductPage()) return;

    if(document.querySelector('.sg-product-share-box')) return;

    const buyWrapper =
      document.querySelector('.t-store__product-snippet .js-product-controls-wrapper') ||
      document.querySelector('.js-product-controls-wrapper');

    if(!buyWrapper) return;

    const box = document.createElement('div');
    box.className = 'sg-product-share-box';

    box.innerHTML = `
      <button class="sg-product-share-main"
              type="button"
              data-tooltip="Поделиться товаром">
        <img src="${SHARE_ICON_URL}"
             class="sg-product-share-icon"
             alt="Поделиться">
        <span>Поделиться</span>
      </button>

      <div class="sg-product-share-menu">
        <a href="#" data-sg-share="telegram">Telegram</a>
        <a href="#" data-sg-share="whatsapp">WhatsApp</a>
        <a href="#" data-sg-share="vk">ВКонтакте</a>
        <a href="#" data-sg-share="max">MAX</a>
        <a href="#" data-sg-share="copy">Скопировать ссылку</a>
      </div>
    `;

    buyWrapper.parentNode.insertBefore(box, buyWrapper.nextSibling);
  }

  async function openNativeShare(){
    const data = getProductDataFromPage();

    trackProductEvent('share', data, { channel: 'native' });

    try{
      await navigator.share({
        title: data.title || document.title || '',
        text: data.title || '',
        url: window.location.href
      });
    }catch(e){}
  }

  function openShare(channel){
    const data = getProductDataFromPage();
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(data.title || document.title || '');

    trackProductEvent('share', data, { channel: channel });

    if(channel === 'telegram'){
      window.open('https://t.me/share/url?url=' + url + '&text=' + title, '_blank');
      return;
    }

    if(channel === 'whatsapp'){
      window.open('https://wa.me/?text=' + title + '%20' + url, '_blank');
      return;
    }

    if(channel === 'vk'){
      window.open('https://vk.com/share.php?url=' + url, '_blank');
      return;
    }

    if(channel === 'max'){
      window.location.href = 'max://send?text=' + url;
      return;
    }

    if(channel === 'copy'){
      navigator.clipboard.writeText(window.location.href);

      const btn = document.querySelector('[data-sg-share="copy"]');

      if(btn){
        const old = btn.textContent;
        btn.textContent = 'Ссылка скопирована';

        setTimeout(function(){
          btn.textContent = old;
        }, 1500);
      }
    }
  }

  function initShareClicks(){
    document.addEventListener('click', function(e){
      const main = e.target.closest('.sg-product-share-main');

      if(main){
        e.preventDefault();
        e.stopPropagation();

        if(navigator.share && window.innerWidth <= 768){
          openNativeShare();
          return;
        }

        const box = main.closest('.sg-product-share-box');
        if(box) box.classList.toggle('is-open');

        return;
      }

      const share = e.target.closest('[data-sg-share]');

      if(share){
        e.preventDefault();
        e.stopPropagation();

        const channel = share.getAttribute('data-sg-share');
        openShare(channel);

        const box = share.closest('.sg-product-share-box');
        if(box) box.classList.remove('is-open');

        return;
      }

      document.querySelectorAll('.sg-product-share-box.is-open').forEach(function(box){
        box.classList.remove('is-open');
      });
    });
  }

  function initClicks(){
    document.addEventListener('click', function(e){
      const target = e.target;

      const card = target.closest('.js-product.t-store__card');

      if(card){
        const btn = target.closest('.t-store__card__btn, .t-btn, a');

        if(btn){
          const text = cleanText(btn.innerText).toLowerCase();
          const href = btn.getAttribute('href') || '';

          if(text.indexOf('купить') !== -1 || href.indexOf('/tproduct/') !== -1){
            trackProductEvent('listing_buy_click', getProductDataFromCard(card));
          }
        }
      }

      if(isProductPage()){
        const productBox = target.closest('.t-store__product-snippet');

        if(productBox){
          const btn = target.closest('.t-btn, button, a');

          if(btn && !btn.closest('.sg-product-share-box')){
            const text = cleanText(btn.innerText).toLowerCase();

            if(
              text.indexOf('купить') !== -1 ||
              text.indexOf('корзин') !== -1 ||
              String(btn.className).indexOf('buy') !== -1
            ){
              trackProductEvent('add_to_cart', getProductDataFromPage());
            }
          }
        }
      }

      const favBtn = target.closest(
        '.t1002__addBtn, .t-store__card__wishlist, .t-store__prod-popup__wishlist, [class*="wishlist"], [class*="wish"]'
      );

      if(favBtn){
        const favCard = favBtn.closest('.js-product.t-store__card');

        if(favCard){
          trackProductEvent('favorite', getProductDataFromCard(favCard));
        }else if(isProductPage()){
          trackProductEvent('favorite', getProductDataFromPage());
        }
      }

    }, true);
  }

  function init(){
    injectCss();
    initProductView();
    addShareBlock();
    initShareClicks();
    initClicks();

    setTimeout(addShareBlock, 500);
    setTimeout(addShareBlock, 1500);
    setTimeout(addShareBlock, 3000);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

})();