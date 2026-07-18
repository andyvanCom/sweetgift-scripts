/*
===========================================================================
SweetGift.ru | Anonymous Order Tracker
---------------------------------------------------------------------------
Записывает состав успешно оформленного заказа без персональных данных.
Не отправляет имена, телефоны, email, адрес и текст поздравления.
===========================================================================
*/

(function () {
  'use strict';

  var RPC_NAME = 'track_product_order';
  var STORAGE_PREFIX = 'sg_order_tracked_';
  var pending = {};

  window.SG = window.SG || {};
  window.SG.orderTracker = window.SG.orderTracker || {};

  var tracker = window.SG.orderTracker;
  tracker.version = '1.0.0';

  function core() {
    return window.SG && window.SG.core ? window.SG.core : null;
  }

  function log() {
    if (window.SG.debug || (core() && core().debug)) {
      console.log.apply(console, ['[SG Order Tracker]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function cleanText(value, maxLength) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, maxLength || 250) : null;
  }

  function number(value) {
    if (typeof value === 'number') return isFinite(value) ? value : null;
    if (value == null || value === '') return null;

    var normalized = String(value)
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    var result = Number(normalized);

    return isFinite(result) ? result : null;
  }

  function integer(value, fallback) {
    var result = parseInt(value, 10);
    return isFinite(result) && result > 0 ? result : (fallback || 1);
  }

  function firstValue(object, keys) {
    var i;
    if (!object) return null;

    for (i = 0; i < keys.length; i += 1) {
      if (object[keys[i]] != null && object[keys[i]] !== '') return object[keys[i]];
    }

    return null;
  }

  function fieldValue(form, names) {
    var i;
    var field;

    if (!form || !form.querySelector) return null;

    for (i = 0; i < names.length; i += 1) {
      field = form.querySelector('[name="' + names[i] + '"]:checked') ||
        form.querySelector('[name="' + names[i] + '"]');
      if (field && field.value != null && String(field.value).trim()) return field.value;
    }

    return null;
  }

  function safePath(url) {
    if (!url) return null;

    try {
      return new URL(url, window.location.origin).pathname.slice(0, 500) || '/';
    } catch (e) {
      return String(url).split('?')[0].split('#')[0].slice(0, 500) || null;
    }
  }

  function productKey(item) {
    var url = firstValue(item, ['url', 'link', 'href', 'productUrl', 'product_url']);
    if (!url) return null;

    if (core() && typeof core().normalizeProductKey === 'function') {
      return cleanText(core().normalizeProductKey(url), 500);
    }

    return safePath(url);
  }

  function categorySlug(key, item) {
    var category = firstValue(item, ['category_slug', 'category', 'categoryName']);
    if (category) return cleanText(category, 160);
    if (!key) return null;

    if (core() && typeof core().getCategorySlug === 'function') {
      return cleanText(core().getCategorySlug(key), 160);
    }

    return cleanText(key.split('/').filter(Boolean)[0], 160);
  }

  function normalizeItem(item, index) {
    var key = productKey(item);
    var quantity = integer(firstValue(item, ['quantity', 'qty', 'count']), 1);
    var price = number(firstValue(item, ['price', 'unitPrice', 'unit_price']));
    var total = number(firstValue(item, ['amount', 'total', 'sum', 'item_total']));

    if (total == null && price != null) total = price * quantity;

    return {
      order_item_index: index,
      product_key: key,
      product_title: cleanText(firstValue(item, ['name', 'title', 'productName']), 300),
      category_slug: categorySlug(key, item),
      quantity: quantity,
      price: price,
      item_total: total
    };
  }

  function cartProducts(cart) {
    var products = firstValue(cart, ['products', 'items', 'goods']);
    return Array.isArray(products) ? products : [];
  }

  function orderId(cart, form) {
    var value = firstValue(window.tildaForm || {}, ['orderIdForStat', 'orderid', 'orderId']) ||
      firstValue(cart, ['orderid', 'orderId', 'order_id', 'id']) ||
      fieldValue(form, ['orderid', 'orderId', 'order_id', 'tranid']);

    if (value) return cleanText(value, 160);

    var existing;
    try {
      existing = window.sessionStorage.getItem('sg_pending_order_id');
      if (existing) return existing;
    } catch (e) {}

    value = 'tilda-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    try {
      window.sessionStorage.setItem('sg_pending_order_id', value);
    } catch (e2) {}

    return value;
  }

  function boolFromChoice(value, truePattern, falsePattern) {
    var normalized = String(value == null ? '' : value).toLowerCase();
    if (!normalized) return null;
    if (falsePattern && falsePattern.test(normalized)) return false;
    if (truePattern && truePattern.test(normalized)) return true;
    return null;
  }

  function buildPayload(form, cartSnapshot) {
    var cart = cartSnapshot || window.tcart || {};
    var products = cartProducts(cart);
    var samSebe = cleanText(fieldValue(form, ['SamSebe', 'samsebe']), 100);
    var message = fieldValue(form, ['HappyMessage', 'happy_message']);
    var freeCard = cleanText(fieldValue(form, ['FreeCard', 'freecard']), 160);
    var discount = number(firstValue(cart, ['discount', 'discountvalue', 'discountValue']));
    var subtotal = number(firstValue(cart, ['prodamount', 'subtotal', 'productsAmount']));
    var orderTotal = number(firstValue(cart, ['amount', 'total', 'orderTotal']));

    return {
      order_id: orderId(cart, form),
      items: products.slice(0, 100).map(normalizeItem),
      order_total: orderTotal,
      subtotal: subtotal,
      discount: discount,
      is_gift: boolFromChoice(samSebe, /подар|друг|получател/, /себе|сам/),
      samsebe: samSebe,
      delivery_date: cleanText(fieldValue(form, ['delivery-date', 'DeliveryDate', 'delivery_date']), 80),
      delivery_interval: cleanText(fieldValue(form, ['delivery-interval', 'DeliveryInterval', 'delivery_interval']), 100),
      delivery_type: cleanText(fieldValue(form, ['delivery', 'Delivery', 'delivery_type']), 160),
      delivery_price: number(firstValue(cart, ['delivery', 'deliveryPrice', 'delivery_price'])),
      payment_system: cleanText(fieldValue(form, ['paymentsystem', 'PaymentSystem']), 100),
      promocode: cleanText(fieldValue(form, ['promocode', 'PromoCode']), 100),
      client_type: cleanText(fieldValue(form, ['ClientType', 'client_type']), 100),
      freecard: freeCard,
      has_message: Boolean(message && String(message).trim()),
      message_length: message ? String(message).trim().length : 0,
      page_url: safePath(window.location.href),
      referrer: safePath(document.referrer)
    };
  }

  function copyCart() {
    var cart = window.tcart || {};
    var copy = {};
    var key;

    for (key in cart) {
      if (Object.prototype.hasOwnProperty.call(cart, key)) copy[key] = cart[key];
    }

    copy.products = cartProducts(cart).map(function (item) {
      var itemCopy = {};
      var itemKey;
      for (itemKey in item) {
        if (Object.prototype.hasOwnProperty.call(item, itemKey)) itemCopy[itemKey] = item[itemKey];
      }
      return itemCopy;
    });

    return copy;
  }

  function wasSent(id) {
    try {
      return window.localStorage.getItem(STORAGE_PREFIX + id) === '1';
    } catch (e) {
      return false;
    }
  }

  function markSent(id) {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + id, '1');
      window.sessionStorage.removeItem('sg_pending_order_id');
    } catch (e) {}
  }

  function send(payload, attempt) {
    var id = payload && payload.order_id;
    if (!id || !payload.items.length || wasSent(id) || pending[id]) return;
    if (!core() || typeof core().rpc !== 'function') {
      if ((attempt || 0) < 20) setTimeout(function () { send(payload, (attempt || 0) + 1); }, 250);
      return;
    }

    pending[id] = true;
    core().rpc(
      RPC_NAME,
      { p_order: payload },
      function (result) {
        delete pending[id];
        if (result && result.ok) {
          markSent(id);
          log('order tracked', id, result.inserted_count);
        }
      },
      function (error) {
        delete pending[id];
        if ((attempt || 0) < 1) {
          setTimeout(function () { send(payload, 1); }, 1000);
        } else {
          console.warn('[SG Order Tracker] RPC error:', error);
        }
      }
    );
  }

  function isCartForm(form) {
    return Boolean(form && (
      form.getAttribute('data-formcart') === 'y' ||
      form.closest('.t706__orderform') ||
      form.closest('.t706')
    ));
  }

  document.addEventListener('tildaform:aftersuccess', function (event) {
    var form = event.target && event.target.tagName === 'FORM' ? event.target :
      (event.target && event.target.closest ? event.target.closest('form') : null);

    if (!isCartForm(form)) return;

    var cartSnapshot = copyCart();
    var payload = buildPayload(form, cartSnapshot);
    send(payload, 0);
  });

  tracker.inspect = function (form) {
    return buildPayload(form || document.querySelector('.t706__orderform form, form[data-formcart="y"]'), copyCart());
  };
})();
