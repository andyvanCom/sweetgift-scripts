/*
===========================================================================
SweetGift.ru | Core
---------------------------------------------------------------------------
Единое ядро SweetGift:
- один клиент Supabase
- общие настройки
- общие утилиты
===========================================================================
*/

(function () {
  'use strict';

  window.SG = window.SG || {};

  if (window.SG.coreReady) return;

  var SUPABASE_URL = 'https://rvgvbxipccbkytmhltmi.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_JrPJQVLLpcDxjte5OSCnvg_ocvpBqqT';

  window.SG.config = window.SG.config || {};
  window.SG.config.supabaseUrl = SUPABASE_URL;
  window.SG.config.supabaseKey = SUPABASE_KEY;

  window.SG.debug = window.SG.debug || false;

  window.SG.log = function () {
    if (window.SG.debug) {
      console.log.apply(console, ['[SweetGift]'].concat(Array.prototype.slice.call(arguments)));
    }
  };

  window.SG.loadScript = function (src, callback) {
    var existing = document.querySelector('script[src="' + src + '"]');

    if (existing) {
      if (callback) callback();
      return;
    }

    var script = document.createElement('script');
    script.src = src;
    script.async = true;

    script.onload = function () {
      if (callback) callback();
    };

    script.onerror = function () {
      console.error('[SweetGift] Script load error:', src);
    };

    document.head.appendChild(script);
  };

  window.SG.loadSupabase = function (callback) {
    if (window.SG.sb) {
      callback(window.SG.sb);
      return;
    }

    if (window.supabase) {
      window.SG.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      callback(window.SG.sb);
      return;
    }

    window.SG.loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', function () {
      if (!window.supabase) {
        console.error('[SweetGift] Supabase library not loaded');
        return;
      }

      window.SG.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      callback(window.SG.sb);
    });
  };

  window.SG.injectCss = function (id, css) {
    if (document.getElementById(id)) return;

    var style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  };

  window.SG.getFingerprint = function () {
    var key = 'sg_product_fp';
    var fp = localStorage.getItem(key);

    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, fp);
    }

    return fp;
  };

  window.SG.coreReady = true;

  window.SG.log('Core ready');

})();