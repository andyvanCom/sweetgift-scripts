/*
===========================================================================
SweetGift.ru | Live Activity Popup v3.0
---------------------------------------------------------------------------

Асинхронный попап живой активности:
- грузится с GitHub/jsDelivr;
- не блокирует загрузку Tilda;
- через 20 секунд показывает товар с активностью;
- берет данные из Supabase;
- показывает фото, название и мягкий бейдж;
- точные цифры пользователю не раскрывает;
- показывается 1 раз за сессию.
===========================================================================
*/

(function(){

  var SUPABASE_URL = 'https://rvgvbxipccbkytmhltmi.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_JrPJQVLLpcDxjte5OSCnvg_ocvpBqqT';

  var POPUP_DELAY = 20000;
  var POPUP_VISIBLE_TIME = 8000;
  var SHOWN_KEY = 'sg_live_popup_shown_v3';

  function log(){
    if(window.SG_DEBUG){
      console.log.apply(console, arguments);
    }
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
      }, 5000);

      return;
    }

    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;

    script.onload = function(){
      callback();
    };

    script.onerror = function(){
      log('Supabase failed to load');
    };

    document.body.appendChild(script);
  }

  function injectCss(){
    if(document.getElementById('sg-live-popup-css')) return;

    var css = `
      .sg-live-popup{
        position:fixed;
        left:24px;
        bottom:24px;
        width:360px;
        max-width:calc(100vw - 32px);
        display:grid;
        grid-template-columns:64px 1fr 24px;
        gap:12px;
        align-items:center;
        padding:12px;
        background:#fff;
        border-radius:18px;
        box-shadow:0 12px 38px rgba(0,0,0,.16);
        text-decoration:none;
        color:#222;
        font-family:Arial,sans-serif;
        z-index:999999;
        opacity:0;
        transform:translateY(20px);
        transition:.35s ease;
      }

      .sg-live-popup.is-visible{
        opacity:1;
        transform:translateY(0);
      }

      .sg-live-img{
        width:64px;
        height:64px;
        border-radius:14px;
        overflow:hidden;
        background:#f6f6f6;
      }

      .sg-live-img img{
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }

      .sg-live-label{
        display:flex;
        align-items:center;
        gap:5px;
        font-size:13px;
        color:#e60000;
        margin-bottom:4px;
        font-weight:600;
      }

      .sg-live-title{
        font-size:15px;
        line-height:1.3;
        font-weight:600;
      }

      .sg-live-close{
        border:0;
        background:none;
        font-size:22px;
        line-height:1;
        color:#999;
        cursor:pointer;
        padding:0;
      }

      .sg-live-close:hover{
        color:#e60000;
      }

      @media(max-width:640px){
        .sg-live-popup{
          left:12px;
          right:12px;
          bottom:16px;
          width:auto;
          max-width:none;
          grid-template-columns:58px 1fr 22px;
          padding:10px;
          border-radius:16px;
        }

        .sg-live-img{
          width:58px;
          height:58px;
        }

        .sg-live-label{
          font-size:12px;
        }

        .sg-live-title{
          font-size:14px;
        }
      }
    `;

    var style = document.createElement('style');
    style.id = 'sg-live-popup-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function escapeHtml(text){
    return String(text || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function getRandomItem(list){
    return list[Math.floor(Math.random() * list.length)];
  }

  function getMessage(item){
    var messages = [];

    if(Number(item.add_to_cart || 0) > 0){
      messages.push({
        icon: '🛒',
        label: 'Недавно добавляли в корзину'
      });
    }

    if(Number(item.purchases || 0) > 0){
      messages.push({
        icon: '🎁',
        label: 'Купили недавно'
      });
    }

    if(Number(item.favorites || 0) > 0){
      messages.push({
        icon: '❤️',
        label: 'Часто сохраняют'
      });
    }

    if(Number(item.shares || 0) > 0){
      messages.push({
        icon: '📤',
        label: 'Этим товаром делились'
      });
    }

    if(Number(item.views || 0) > 0){
      messages.push({
        icon: '👀',
        label: 'Часто смотрят'
      });
    }

    messages.push({
      icon: '🔥',
      label: 'Популярный товар'
    });

    return getRandomItem(messages);
  }

  function showActivityPopup(item){
    if(!item || !item.title || !item.product_key) return;
    if(document.querySelector('.sg-live-popup')) return;

    injectCss();

    var message = getMessage(item);

    var popup = document.createElement('a');
    popup.className = 'sg-live-popup';
    popup.href = item.product_key;

    popup.innerHTML =
      '<div class="sg-live-img">' +
        (item.image ? '<img src="' + escapeHtml(item.image) + '" alt="">' : '') +
      '</div>' +

      '<div class="sg-live-content">' +
        '<div class="sg-live-label">' +
          '<span>' + message.icon + '</span>' +
          escapeHtml(message.label) +
        '</div>' +

        '<div class="sg-live-title">' +
          escapeHtml(item.title) +
        '</div>' +
      '</div>' +

      '<button class="sg-live-close" type="button" aria-label="Закрыть">×</button>';

    document.body.appendChild(popup);

    var closeBtn = popup.querySelector('.sg-live-close');

    closeBtn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();

      popup.classList.remove('is-visible');

      setTimeout(function(){
        if(document.body.contains(popup)){
          popup.remove();
        }
      }, 400);
    });

    setTimeout(function(){
      popup.classList.add('is-visible');
    }, 100);

    setTimeout(function(){
      if(!document.body.contains(popup)) return;

      popup.classList.remove('is-visible');

      setTimeout(function(){
        if(document.body.contains(popup)){
          popup.remove();
        }
      }, 400);
    }, POPUP_VISIBLE_TIME);
  }

  function init(){
    if(sessionStorage.getItem(SHOWN_KEY)){
      return;
    }

    setTimeout(function(){

      loadSupabase(function(){

        if(!window.supabase){
          return;
        }

        var sb = supabase.createClient(
          SUPABASE_URL,
          SUPABASE_KEY
        );

        sb.rpc('get_recent_product_activity').then(function(res){

          if(res.error){
            log('Live popup RPC error:', res.error);
            return;
          }

          if(!res.data || !res.data.length){
            return;
          }

          var item = getRandomItem(res.data);

          sessionStorage.setItem(SHOWN_KEY, '1');

          showActivityPopup(item);

        }).catch(function(err){
          log('Live popup error:', err);
        });

      });

    }, POPUP_DELAY);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

})();
