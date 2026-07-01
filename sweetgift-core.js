/*
===========================================================================
SweetGift.ru | Core
---------------------------------------------------------------------------
Общее ядро для модулей SweetGift:
- единый Supabase client
- загрузка Supabase SDK
- общие утилиты
- visitor_id / session_id
- определение типа страниц
- ожидание DOM-элементов
- безопасные события Tilda Store
===========================================================================
*/

(function () {
  'use strict';

  var SUPABASE_URL = 'https://rvgvbxipccbkytmhltmi.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_JrPJQVLLpcDxjte5OSCnvg_ocvpBqqT';

  window.SG = window.SG || {};
  window.SG.core = window.SG.core || {};

  var core = window.SG.core;

  core.version = '1.1.0';
  core.debug = core.debug || false;

  core._supabaseClient = core._supabaseClient || null;
  core._supabaseLoading = core._supabaseLoading || false;
  core._supabaseCallbacks = core._supabaseCallbacks || [];
  core._storeRenderedCallbacks = core._storeRenderedCallbacks || [];
  core._storeRenderedBound = core._storeRenderedBound || false;

  function log() {
    if (core.debug || window.SG.debug) {
      console.log.apply(console, ['[SG Core]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function warn() {
    console.warn.apply(console, ['[SG Core]'].concat(Array.prototype.slice.call(arguments)));
  }

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }

  function safeLocalStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    return 'sg-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function getOrCreateStorageValue(key, prefix) {
    var value = safeLocalStorageGet(key);

    if (value) return value;

    value = (prefix || 'sg') + '-' + uuid();
    safeLocalStorageSet(key, value);

    return value;
  }

  core.getVisitorId = function () {
    return getOrCreateStorageValue('sg_visitor_id', 'visitor');
  };

  core.getSessionId = function () {
    var key = 'sg_session';
    var now = Date.now();
    var ttl = 30 * 60 * 1000;
    var session = safeJsonParse(safeLocalStorageGet(key), null);

    if (session && session.id && session.updated_at && now - session.updated_at < ttl) {
      session.updated_at = now;
      safeLocalStorageSet(key, JSON.stringify(session));
      return session.id;
    }

    session = {
      id: 'session-' + uuid(),
      created_at: now,
      updated_at: now
    };

    safeLocalStorageSet(key, JSON.stringify(session));

    return session.id;
  };

  core.loadScript = function (src, callback, errorCallback) {
    var existing = document.querySelector('script[src="' + src + '"]') ||
      Array.from(document.scripts).find(function (script) {
        return script.src === src;
      });

    if (existing) {
      if (callback) {
        if (existing.getAttribute('data-sg-loaded') === '1') {
          callback();
        } else {
          existing.addEventListener('load', callback, { once: true });
        }
      }
      return;
    }

    var script = document.createElement('script');
    script.src = src;
    script.async = true;

    script.onload = function () {
      script.setAttribute('data-sg-loaded', '1');
      if (callback) callback();
    };

    script.onerror = function () {
      if (errorCallback) {
        errorCallback();
      } else {
        warn('Script load error:', src);
      }
    };

    document.head.appendChild(script);
  };

  core.supabase = function (callback) {
    if (core._supabaseClient) {
      callback(core._supabaseClient);
      return;
    }

    core._supabaseCallbacks.push(callback);

    if (core._supabaseLoading) return;

    core._supabaseLoading = true;

    function createClient() {
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        core._supabaseLoading = false;
        warn('Supabase SDK not available');
        return;
      }

   if (!core._supabaseClient) {
  core._supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  );
}

      core._supabaseLoading = false;

      var callbacks = core._supabaseCallbacks.slice();
      core._supabaseCallbacks = [];

      callbacks.forEach(function (fn) {
        try {
          fn(core._supabaseClient);
        } catch (e) {
          warn('Supabase callback error:', e);
        }
      });

      log('Supabase ready');
    }

    if (window.supabase && typeof window.supabase.createClient === 'function') {
      createClient();
      return;
    }

    var existing = document.querySelector('script[src*="supabase-js"]');

    if (existing) {
      var timer = setInterval(function () {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          clearInterval(timer);
          createClient();
        }
      }, 100);

      setTimeout(function () {
        clearInterval(timer);
        if (!core._supabaseClient) {
          core._supabaseLoading = false;
          warn('Supabase SDK timeout');
        }
      }, 7000);

      return;
    }

    core.loadScript(
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
      createClient,
      function () {
        core._supabaseLoading = false;
        warn('Supabase SDK load error');
      }
    );
  };

  core.rpc = function (name, params, callback, errorCallback) {
    core.supabase(function (sb) {
      sb.rpc(name, params || {}).then(function (res) {
        if (res.error) {
          if (errorCallback) {
            errorCallback(res.error);
          } else {
            warn('RPC error:', name, res.error);
          }
          return;
        }

        if (callback) callback(res.data);
      });
    });
  };

  core.currentPath = function () {
    return window.location.pathname || '/';
  };

  core.normalizePath = function (url) {
    try {
      return new URL(url, window.location.origin).pathname.replace(/\/$/, '');
    } catch (e) {
      return String(url || '').split('?')[0].replace(window.location.origin, '').replace(/\/$/, '');
    }
  };

  core.normalizeProductKey = function (url) {
    return core.normalizePath(url);
  };

  core.getCategorySlug = function (url) {
    var path = core.normalizePath(url || window.location.pathname);
    var parts = path.split('/').filter(Boolean);

    if (parts.length >= 3 && parts[1] === 'tproduct') {
      return parts[0];
    }

    if (parts.length >= 1) {
      return parts[0];
    }

    return '';
  };

  core.getProductIdFromPath = function (url) {
    var path = core.normalizePath(url || window.location.pathname);
    var parts = path.split('/').filter(Boolean);
    var index = parts.indexOf('tproduct');

    if (index !== -1 && parts[index + 1]) {
      return String(parts[index + 1]).split('-')[0];
    }

    return '';
  };

  core.isProductPage = function () {
    return core.currentPath().indexOf('/tproduct/') !== -1;
  };

  core.isArticlePage = function () {
    return core.currentPath().indexOf('/stati/') === 0;
  };

  core.isTopPage = function () {
    var path = core.currentPath();
    return path === '/top' || path.indexOf('/top/') === 0;
  };

  core.isOrderPage = function () {
    var path = core.currentPath();
    return path.indexOf('/order') === 0 || path.indexOf('/success') !== -1 || path.indexOf('/spasibo') !== -1;
  };

  core.escapeHtml = function (text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  core.formatNumber = function (num) {
    return Number(num || 0).toLocaleString('ru-RU');
  };

  core.debounce = function (fn, delay) {
    var timer;

    return function () {
      var args = arguments;
      var context = this;

      clearTimeout(timer);

      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  };

  core.throttle = function (fn, delay) {
    var last = 0;
    var timer;

    return function () {
      var now = Date.now();
      var args = arguments;
      var context = this;

      if (now - last >= delay) {
        last = now;
        fn.apply(context, args);
        return;
      }

      clearTimeout(timer);
      timer = setTimeout(function () {
        last = Date.now();
        fn.apply(context, args);
      }, delay - (now - last));
    };
  };

  core.wait = function (selector, callback, options) {
    options = options || {};

    var timeout = options.timeout || 7000;
    var interval = options.interval || 100;
    var startedAt = Date.now();

    var existing = document.querySelector(selector);

    if (existing) {
      callback(existing);
      return;
    }

    var timer = setInterval(function () {
      var el = document.querySelector(selector);

      if (el) {
        clearInterval(timer);
        callback(el);
        return;
      }

      if (Date.now() - startedAt > timeout) {
        clearInterval(timer);

        if (options.onTimeout) {
          options.onTimeout();
        }
      }
    }, interval);
  };

  core.waitAll = function (selector, callback, options) {
    options = options || {};

    var timeout = options.timeout || 7000;
    var interval = options.interval || 100;
    var startedAt = Date.now();

    var existing = Array.from(document.querySelectorAll(selector));

    if (existing.length) {
      callback(existing);
      return;
    }

    var timer = setInterval(function () {
      var list = Array.from(document.querySelectorAll(selector));

      if (list.length) {
        clearInterval(timer);
        callback(list);
        return;
      }

      if (Date.now() - startedAt > timeout) {
        clearInterval(timer);

        if (options.onTimeout) {
          options.onTimeout();
        }
      }
    }, interval);
  };

  core.ready = function (callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  };

  core.onLoad = function (callback) {
    if (document.readyState === 'complete') {
      callback();
    } else {
      window.addEventListener('load', callback, { once: true });
    }
  };

  core.onStoreRendered = function (callback) {
    if (typeof callback !== 'function') return;

    core._storeRenderedCallbacks.push(callback);

    if (core._storeRenderedBound) return;

    core._storeRenderedBound = true;

    function fire() {
      core._storeRenderedCallbacks.forEach(function (fn) {
        try {
          fn();
        } catch (e) {
          warn('Store rendered callback error:', e);
        }
      });
    }

    if (window.jQuery) {
      window.jQuery(window).on('tStoreRendered', fire);
    }

    document.addEventListener('tStoreRendered', fire);
  };

  core.getDeviceType = function () {
    var width = window.innerWidth || document.documentElement.clientWidth || 0;

    if (width <= 640) return 'mobile';
    if (width <= 1024) return 'tablet';

    return 'desktop';
  };

  core.getUtm = function () {
    var params = new URLSearchParams(window.location.search || '');

    return {
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
      content: params.get('utm_content') || '',
      term: params.get('utm_term') || ''
    };
  };

  core.getSearchEngine = function (referrer) {
    referrer = String(referrer || document.referrer || '').toLowerCase();

    if (referrer.indexOf('yandex.') !== -1) return 'yandex';
    if (referrer.indexOf('google.') !== -1) return 'google';
    if (referrer.indexOf('bing.') !== -1) return 'bing';
    if (referrer.indexOf('duckduckgo.') !== -1) return 'duckduckgo';
    if (referrer.indexOf('mail.ru') !== -1) return 'mailru';
    if (referrer.indexOf('rambler.') !== -1) return 'rambler';

    return '';
  };

  core.getTrafficSource = function () {
    var utm = core.getUtm();
    var referrer = document.referrer || '';
    var searchEngine = core.getSearchEngine(referrer);

    if (utm.source || utm.medium || utm.campaign) {
      return {
        source: utm.source || '',
        medium: utm.medium || '',
        campaign: utm.campaign || '',
        content: utm.content || '',
        term: utm.term || '',
        referrer: referrer,
        search_engine: searchEngine
      };
    }

    if (searchEngine) {
      return {
        source: searchEngine,
        medium: 'organic',
        campaign: '',
        content: '',
        term: '',
        referrer: referrer,
        search_engine: searchEngine
      };
    }

    if (referrer) {
      return {
        source: 'referral',
        medium: 'referral',
        campaign: '',
        content: '',
        term: '',
        referrer: referrer,
        search_engine: ''
      };
    }

    return {
      source: 'direct',
      medium: 'direct',
      campaign: '',
      content: '',
      term: '',
      referrer: '',
      search_engine: ''
    };
  };

  core.getEntryPageType = function (url) {
    var path = core.normalizePath(url || window.location.pathname);

    if (path === '/') return 'home';
    if (path.indexOf('/stati/') === 0) return 'article';
    if (path.indexOf('/tproduct/') !== -1) return 'product';
    if (path.indexOf('/top') === 0) return 'top';

    return 'page';
  };

  core.getEntrySlug = function (url) {
    var path = core.normalizePath(url || window.location.pathname);
    var parts = path.split('/').filter(Boolean);

    if (!parts.length) return 'home';

    return parts[parts.length - 1] || parts[0];
  };

  core.getFirstTouch = function () {
    var key = 'sg_first_touch';
    var saved = safeJsonParse(safeLocalStorageGet(key), null);

    if (saved && saved.first_landing_page) {
      return saved;
    }

    var traffic = core.getTrafficSource();
    var path = core.currentPath();

    var touch = {
      first_landing_page: path,
      first_referrer: traffic.referrer,
      first_search_engine: traffic.search_engine,
      first_source: traffic.source,
      first_medium: traffic.medium,
      first_campaign: traffic.campaign,
      first_content: traffic.content,
      first_term: traffic.term,
      first_visit_at: new Date().toISOString(),

      entry_page_type: core.getEntryPageType(path),
      entry_slug: core.getEntrySlug(path),
      entry_category: core.getCategorySlug(path),

      first_device: core.getDeviceType()
    };

    safeLocalStorageSet(key, JSON.stringify(touch));

    return touch;
  };

  core.getLastTouch = function () {
    var traffic = core.getTrafficSource();
    var path = core.currentPath();

    return {
      last_landing_page: path,
      last_referrer: traffic.referrer,
      last_search_engine: traffic.search_engine,
      last_source: traffic.source,
      last_medium: traffic.medium,
      last_campaign: traffic.campaign,
      last_content: traffic.content,
      last_term: traffic.term,
      last_visit_at: new Date().toISOString(),

      last_page_type: core.getEntryPageType(path),
      last_slug: core.getEntrySlug(path),
      last_category: core.getCategorySlug(path),

      last_device: core.getDeviceType()
    };
  };

  core.getAttribution = function () {
    return {
      visitor_id: core.getVisitorId(),
      session_id: core.getSessionId(),
      first_touch: core.getFirstTouch(),
      last_touch: core.getLastTouch()
    };
  };

  core.ready(function () {
    core.getVisitorId();
    core.getSessionId();
    core.getFirstTouch();
    log('Ready', {
      version: core.version,
      path: core.currentPath()
    });
  });

})();