/*
===========================================================================
SweetGift.ru | Live Activity Popup v4
---------------------------------------------------------------------------
Асинхронный попап живой активности.
Безопасно грузится после сайта, не блокирует Tilda и не должен ломать страницу.
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};
  window.SG.debug = window.SG.debug || false;

  var CONFIG = {
    supabaseUrl: 'https://rvgvbxipccbkytmhltmi.supabase.co',
    supabaseKey: 'sb_publishable_JrPJQVLLpcDxjte5OSCnvg_ocvpBqqT',
    popupDelay: 20000,
    visibleTime: 8000,
    sessionKey: 'sg_live_popup_shown_v4',
    cssId: 'sg-live-popup-css-v4'
  };

  function log() {
    if (window.SG && window.SG.debug) {
      console.log.apply(console, ['[SG Popup]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function safe(fn) {
    try {
      fn();
    } catch (e) {
      log('Error:', e);
    }
  }

  function loadSupabase(callback) {
    if (window.supabase) {
      callback();
      return;
    }

    var existing = document.querySelector('script[src*="supabase-js"]');

    if (existing) {
      var timer = setInterval(function () {
        if (window.supabase) {
          clearInterval(timer);
          callback();
        }
      }, 100);

      setTimeout(function () {
        clearInterval(timer);
      }, 7000);

      return;
    }

    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;

    script.onload = function () {
      log('Supabase loaded');
      callback();
    };

    script.onerror = function () {
      log('Supabase load failed');
    };

    document.body.appendChild(script);
  }

  function injectCss() {
    if (document.getElementById(CONFIG.cssId)) return;

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
}`;

    var style = document.createElement('style');
    style.id = CONFIG.cssId;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function getMessage(item) {
    var messages = [];

    if (Number(item.purchases || 0) > 0) {
      messages.push({ icon: '🎁', label: 'Купили недавно' });
    }

    if (Number(item.add_to_cart || 0) > 0) {
      messages.push({ icon: '🛒', label: 'Недавно добавляли в корзину' });
    }

    if (Number(item.favorites || 0) > 0) {
      messages.push({ icon: '❤️', label: 'Часто сохраняют' });
    }

    if (Number(item.shares || 0) > 0) {
      messages.push({ icon: '📤', label: 'Этим товаром делились' });
    }

    if (Number(item.views || 0) > 0) {
      messages.push({ icon: '👀', label: 'Часто смотрят' });
    }

    messages.push({ icon: '🔥', label: 'Популярный товар' });

    return randomItem(messages);
  }

  function showPopup(item) {
    if (!item || !item.title || !item.product_key) return;
    if (document.querySelector('.sg-live-popup')) return;

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
        '<div class="sg-live-label"><span>' + message.icon + '</span>' + escapeHtml(message.label) + '</div>' +
        '<div class="sg-live-title">' + escapeHtml(item.title) + '</div>' +
      '</div>' +
      '<button class="sg-live-close" type="button" aria-label="Закрыть">×</button>';

    document.body.appendChild(popup);

    var closeBtn = popup.querySelector('.sg-live-close');

    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      hidePopup(popup);
    });

    setTimeout(function () {
      popup.classList.add('is-visible');
    }, 100);

    setTimeout(function () {
      hidePopup(popup);
    }, CONFIG.visibleTime);

    log('Popup shown', item);
  }

  function hidePopup(popup) {
    if (!popup || !document.body.contains(popup)) return;

    popup.classList.remove('is-visible');

    setTimeout(function () {
      if (document.body.contains(popup)) {
        popup.remove();
      }
    }, 400);
  }

  function loadActivity() {
    loadSupabase(function () {
      if (!window.supabase) return;

      var sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

      sb.rpc('get_recent_product_activity')
        .then(function (res) {
          log('RPC result', res);

          if (res.error || !res.data || !res.data.length) return;

          sessionStorage.setItem(CONFIG.sessionKey, '1');

          showPopup(randomItem(res.data));
        })
        .catch(function (err) {
          log('RPC error', err);
        });
    });
  }

  function init() {
    safe(function () {
      log('Init');

      if (sessionStorage.getItem(CONFIG.sessionKey)) {
        log('Already shown in this session');
        return;
      }

      setTimeout(loadActivity, CONFIG.popupDelay);
    });
  }

  window.SG.livePopup = {
    init: init,
    showTest: function () {
      showPopup({
        product_key: '/',
        title: 'Тестовый товар SweetGift',
        image: '',
        views: 1
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();