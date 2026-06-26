/*
===========================================================================
SweetGift.ru | Product Real Activity Badges
---------------------------------------------------------------------------
Выводит бейджи активности товара на основе реальной статистики Supabase.
Не показывает бейджи всем подряд: только если товар прошел заданные пороги.
===========================================================================
*/

(function () {
  'use strict';

  var SUPABASE_URL = 'https://rvgvbxipccbkytmhltmi.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_JrPJQVLLpcDxjte5OSCnvg_ocvpBqqT';

  var CONFIG = {
    maxProductsPerRequest: 80,
    debug: false
  };

  var BADGES = {
    shares: {
      enabled: true,
      min: 3,
      icon: '📤',
      text: 'Этим товаром делятся',
      tip: 'Покупатели делятся ссылкой на этот товар'
    },

    cart: {
      enabled: true,
      min: 5,
      icon: '🛒',
      text: 'Часто добавляют в корзину',
      tip: 'Этот товар часто добавляют в корзину'
    },

    listingClicks: {
      enabled: true,
      min: 20,
      icon: '🔎',
      text: 'Часто внимательно изучают',
      tip: 'Покупатели часто переходят к подробному изучению этого товара'
    },

    favorites: {
      enabled: true,
      min: 5,
      icon: '❤️',
      text: 'Часто сохраняют',
      tip: 'Этот товар часто добавляют в избранное'
    },

    views: {
      enabled: true,
      min: 30,
      icon: '👀',
      text: 'Часто смотрят',
      tip: 'Карточку этого товара часто открывают'
    },

    popularity: {
      enabled: true,
      min: 300,
      icon: '🔥',
      text: 'Популярный товар',
      tip: 'Товар набрал высокий общий индекс популярности'
    }
  };

  function log() {
    if (CONFIG.debug) {
      console.log.apply(console, ['[SG Product Badges]'].concat(Array.prototype.slice.call(arguments)));
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
    script.onload = callback;
    document.head.appendChild(script);
  }

  function normalizeKey(url) {
    try {
      return new URL(url, window.location.origin).pathname;
    } catch (e) {
      return String(url || '').split('?')[0];
    }
  }

  function getProductKey(node) {
    var url =
      node.getAttribute('data-product-url') ||
      (node.querySelector('a[href*="/tproduct/"]') || {}).href ||
      '';

    if (!url && window.location.pathname.indexOf('/tproduct/') !== -1) {
      url = window.location.pathname;
    }

    return normalizeKey(url);
  }

  function getProductNodes() {
    return Array.from(document.querySelectorAll(
      '.js-product.t-store__card, .t-store__product-snippet, .t-store__prod-popup__info'
    ));
  }

  function pickBadge(item) {
    var checks = [
      {
        key: 'shares',
        value: Number(item.shares || 0)
      },
      {
        key: 'cart',
        value: Number(item.add_to_cart || 0)
      },
      {
        key: 'listingClicks',
        value: Number(item.listing_clicks || 0)
      },
      {
        key: 'favorites',
        value: Number(item.favorites || 0)
      },
      {
        key: 'views',
        value: Number(item.views || 0)
      },
      {
        key: 'popularity',
        value: Number(item.popularity_score || 0)
      }
    ];

    for (var i = 0; i < checks.length; i++) {
      var rule = BADGES[checks[i].key];

      if (rule && rule.enabled && checks[i].value > rule.min) {
        return rule;
      }
    }

    return null;
  }

  function renderBadge(node, badge) {
    node.querySelectorAll('.sg-product-activity').forEach(function (el) {
      el.remove();
    });

    if (!badge) return;

    var priceWrapper = node.querySelector('.js-store-price-wrapper');
    if (!priceWrapper) return;

    var el = document.createElement('div');
    el.className = 'js-store-sold-out t-descr t-descr_xxs sg-product-activity';
    el.setAttribute('data-tooltip', badge.tip || badge.text);
    el.setAttribute('data-sg-real-badge', '1');

    el.innerHTML =
      '<span class="emoji">' + badge.icon + '</span>' +
      '<span class="text">' + badge.text + '</span>';

    if (node.classList.contains('t-store__product-snippet') || node.classList.contains('t-store__prod-popup__info')) {
      priceWrapper.after(el);
    } else {
      priceWrapper.appendChild(el);
    }
  }

  function applyBadges(rows) {
    var byKey = {};

    (rows || []).forEach(function (item) {
      byKey[item.product_key] = item;
    });

    getProductNodes().forEach(function (node) {
      var key = getProductKey(node);
      var item = byKey[key];

      if (!item) {
        renderBadge(node, null);
        return;
      }

      renderBadge(node, pickBadge(item));
    });
  }

  function run() {
    var nodes = getProductNodes();

    if (!nodes.length) return;

    var keys = nodes
      .map(getProductKey)
      .filter(Boolean)
      .filter(function (value, index, arr) {
        return arr.indexOf(value) === index;
      })
      .slice(0, CONFIG.maxProductsPerRequest);

    if (!keys.length) return;

    loadSupabase(function () {
      var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      sb.rpc('get_product_activity_badges', {
        product_keys: keys
      }).then(function (res) {
        if (res.error) {
          log('RPC error', res.error);
          return;
        }

        applyBadges(res.data || []);
      });
    });
  }

  function debounce(fn, delay) {
    var timer;

    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  var debouncedRun = debounce(run, 500);

  window.addEventListener('load', function () {
    setTimeout(run, 800);
    setTimeout(run, 2500);
    setTimeout(run, 5000);
  });

  if (window.jQuery) {
    jQuery(window).on('tStoreRendered', function () {
      debouncedRun();
    });
  }

})();