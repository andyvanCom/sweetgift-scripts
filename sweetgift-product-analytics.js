/*
===========================================================================
SweetGift.ru | Product Analytics
---------------------------------------------------------------------------
✓ просмотры товаров
✓ купить в листинге
✓ купить в карточке
✓ избранное
Использует SweetGift Core.
===========================================================================
*/

(function () {
  'use strict';

  var VIEW_TTL = 30 * 60 * 1000;
  var CLICK_TTL = 3 * 1000;

  function core() {
    return window.SG && window.SG.core ? window.SG.core : null;
  }

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeProductKey(url) {
    if (core() && typeof core().normalizeProductKey === 'function') {
      return core().normalizeProductKey(url);
    }

    try {
      return new URL(url, window.location.origin).pathname.replace(/\/$/, '');
    } catch (e) {
      return String(url || '').replace(window.location.origin, '').replace(/\/$/, '');
    }
  }

  function isProductPage() {
    if (core() && typeof core().isProductPage === 'function') {
      return core().isProductPage();
    }

    return window.location.pathname.indexOf('/tproduct/') !== -1;
  }

  function getFingerprint() {
    if (core() && typeof core().getVisitorId === 'function') {
      return core().getVisitorId();
    }

    var fp = localStorage.getItem('sg_product_fp');

    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('sg_product_fp', fp);
    }

    return fp;
  }

  function getCategoryFromUrl(url) {
    if (core() && typeof core().getCategorySlug === 'function') {
      return core().getCategorySlug(url);
    }

    var key = normalizeProductKey(url || window.location.pathname);
    var parts = key.split('/').filter(Boolean);

    return parts[0] || null;
  }

  function getPageProductKey() {
    return window.location.pathname.replace(/\/$/, '');
  }

  function getProductTitleFromPage() {
    return cleanText(
      (document.querySelector('h1') || {}).innerText ||
      (document.querySelector('.js-store-prod-name') || {}).innerText ||
      (document.querySelector('.t-store__prod-popup__name') || {}).innerText ||
      document.title ||
      ''
    );
  }

  function getProductImageFromPage() {
    var image = '';

    var og = document.querySelector('meta[property="og:image"]');
    if (og && og.content) image = og.content;

    if (!image) {
      document.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
        try {
          var json = JSON.parse(s.textContent);

          if (json.image) {
            image = Array.isArray(json.image) ? json.image[0] : json.image;
          }

          if (!image && json['@graph']) {
            json['@graph'].forEach(function (item) {
              if (!image && item.image) {
                image = Array.isArray(item.image) ? item.image[0] : item.image;
              }
            });
          }
        } catch (e) {}
      });
    }

    if (!image) {
      image =
        (document.querySelector('.t-store__product-snippet img') || {}).src ||
        (document.querySelector('.t-slds__bgimg') || {}).getAttribute?.('data-original') ||
        '';
    }

    return image || null;
  }

  function getProductDataFromCard(card) {
    var link =
      card.querySelector('a[href*="/tproduct/"]') ||
      card.querySelector('[href*="/tproduct/"]');

    var productKey = link ? normalizeProductKey(link.href) : null;

    var title = cleanText(
      (card.querySelector('.t-store__card__title') || {}).innerText ||
      (card.querySelector('.js-store-prod-name') || {}).innerText ||
      (card.querySelector('.t-name') || {}).innerText ||
      ''
    );

    var image = '';

    var img = card.querySelector('img');
    if (img) {
      image = img.getAttribute('data-original') || img.getAttribute('src') || '';
    }

    if (!image) {
      var bg = card.querySelector('.t-store__card__imgwrapper, .t-bgimg, .t-slds__bgimg');
      image = bg ? bg.getAttribute('data-original') || '' : '';
    }

    return {
      productKey: productKey,
      title: title,
      image: image || null,
      category: productKey ? getCategoryFromUrl(productKey) : null
    };
  }

  function getProductDataFromPage() {
    return {
      productKey: getPageProductKey(),
      title: getProductTitleFromPage(),
      image: getProductImageFromPage(),
      category: getCategoryFromUrl(window.location.pathname)
    };
  }

  function canTrack(key, ttl) {
    var storageKey = 'sg_track_' + key;
    var last = Number(localStorage.getItem(storageKey) || 0);
    var now = Date.now();

    if (last && now - last < ttl) {
      return false;
    }

    localStorage.setItem(storageKey, String(now));
    return true;
  }

  function getUtmSource() {
    if (core() && typeof core().getTrafficSource === 'function') {
      return core().getTrafficSource().source || null;
    }

    return new URLSearchParams(window.location.search).get('utm_source') || null;
  }

  function trackProductEvent(eventType, data, options) {
    if (!data || !data.productKey) return;
    if (!core() || typeof core().rpc !== 'function') return;

    var channel = options && options.channel ? options.channel : null;
    var uniqueKey = eventType + '_' + (channel || 'none') + '_' + data.productKey;

    if (eventType === 'view' && !canTrack(uniqueKey, VIEW_TTL)) return;
    if (eventType !== 'view' && !canTrack(uniqueKey, CLICK_TTL)) return;

    core().rpc(
      'track_product_event',
      {
        p_product_key: data.productKey,
        p_event_type: eventType,
        p_title: data.title || null,
        p_image: data.image || null,
        p_category: data.category || null,
        p_category_slug: data.category || null,
        p_source: getUtmSource(),
        p_channel: channel,
        p_page_url: window.location.href,
        p_referrer: document.referrer || null,
        p_fingerprint: getFingerprint(),
        p_rating: null
      },
      function () {
        if (window.SG && window.SG.debug) {
          console.log('[SG Product Analytics] tracked:', eventType, channel || '', data.productKey);
        }
      },
      function (error) {
        console.log('[SG Product Analytics] error:', eventType, error);
      }
    );
  }

  function initProductView() {
    if (!isProductPage()) return;

    trackProductEvent('view', getProductDataFromPage());
  }

  function initClicks() {
    document.addEventListener('click', function (e) {
      var target = e.target;

      var card = target.closest('.js-product.t-store__card');

      if (card) {
        var btn = target.closest('.t-store__card__btn, .t-btn, a');

        if (btn) {
          var text = cleanText(btn.innerText).toLowerCase();
          var href = btn.getAttribute('href') || '';

          if (text.indexOf('купить') !== -1 || href.indexOf('/tproduct/') !== -1) {
            trackProductEvent('listing_buy_click', getProductDataFromCard(card), {
              channel: 'listing'
            });
          }
        }
      }

      if (isProductPage()) {
        var productBox = target.closest('.t-store__product-snippet');

        if (productBox) {
          var productBtn = target.closest('.t-btn, button, a');

          if (productBtn && !productBtn.closest('.sg-product-share-box')) {
            var btnText = cleanText(productBtn.innerText).toLowerCase();

            if (
              btnText.indexOf('купить') !== -1 ||
              btnText.indexOf('корзин') !== -1 ||
              String(productBtn.className).indexOf('buy') !== -1
            ) {
              trackProductEvent('add_to_cart', getProductDataFromPage(), {
                channel: 'product'
              });
            }
          }
        }
      }

      var favBtn = target.closest(
        '.t1002__addBtn, .t-store__card__wishlist, .t-store__prod-popup__wishlist, [class*="wishlist"], [class*="wish"]'
      );

      if (favBtn) {
        var favCard = favBtn.closest('.js-product.t-store__card');

        if (favCard) {
          trackProductEvent('favorite', getProductDataFromCard(favCard), {
            channel: 'listing'
          });
        } else if (isProductPage()) {
          trackProductEvent('favorite', getProductDataFromPage(), {
            channel: 'product'
          });
        }
      }
    }, true);
  }

  function init() {
    initProductView();
    initClicks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();