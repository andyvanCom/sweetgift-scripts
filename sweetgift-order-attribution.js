/* Checkout attribution only. No customer/contact data and no conversion sending. */
(function () {
  'use strict';
  if (!/^(www\.)?sweetgift\.ru$/.test(window.location.hostname || new URL(window.location.href).hostname)) return;
  window.SG = window.SG || {};
  var key = 'sg_order_attribution_v1', memory, clientId, attempts = 0, initialReferrerRead = false, evaluatedLocation = null;
  var campaignNames = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var storedNames = campaignNames.concat([
    'yclid', 'campaign_id', 'utm_referrer', 'visited_at', 'landing_page',
    'last_touch_at', 'last_touch_landing_page', 'last_touch_referrer',
    'last_touch_yclid', 'last_touch_campaign_id', 'last_touch_utm_source',
    'last_touch_utm_medium', 'last_touch_utm_campaign', 'last_touch_utm_content',
    'last_touch_utm_term', 'attribution_version'
  ]);
  function text(value, max) {
    value = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    return value ? value.slice(0, max || 300) : null;
  }
  function digits(value) { return typeof value === 'string' && /^\d{6,30}$/.test(value) ? value : null; }
  function cookie() {
    var match = String(document.cookie || '').match(/(?:^|;\s*)_ym_uid=(\d{6,30})(?:;|$)/);
    return match ? match[1] : null;
  }
  function safeSiteUrl(value) {
    try {
      var url = new URL(value, window.location.origin);
      if (url.protocol !== 'https:' || !/^(www\.)?sweetgift\.ru$/.test(url.hostname) || url.username || url.password) return null;
      return url.origin + url.pathname;
    } catch (_) { return null; }
  }
  function safeReferrer(value) {
    try {
      var url = new URL(value);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
      return (url.origin + url.pathname).slice(0, 300);
    } catch (_) { return null; }
  }
  function externalReferrer(value) {
    var referrer = safeReferrer(value);
    if (!referrer) return null;
    try {
      return /^(www\.)?sweetgift\.ru$/.test(new URL(referrer).hostname) ? null : referrer;
    } catch (_) { return null; }
  }
  function currentTouch() {
    var url = new URL(window.location.href), query = url.searchParams;
    var result = {
      visited_at: new Date().toISOString(),
      landing_page: safeSiteUrl(url.href),
      attribution_version: '2'
    };
    campaignNames.forEach(function (name) {
      var value = text(query.get(name));
      if (value) result[name] = value;
    });
    var yclid = digits(text(query.get('yclid')));
    if (yclid) result.yclid = yclid;
    var campaign = text(query.get('campaign_id'), 20);
    if (/^\d{1,20}$/.test(campaign || '')) result.campaign_id = campaign;
    var referrer = safeReferrer(query.get('utm_referrer')) || (!initialReferrerRead && externalReferrer(document.referrer));
    initialReferrerRead = true;
    if (referrer) result.utm_referrer = referrer;
    var ymUid = cookie();
    if (ymUid) result.ym_uid = ymUid;
    return result;
  }
  function isSignificant(touch) {
    return Boolean(touch.utm_referrer || touch.yclid || touch.campaign_id || campaignNames.some(function (name) { return touch[name]; }));
  }
  function lastSignature(touch) {
    return [touch.landing_page, touch.utm_referrer, touch.yclid, touch.campaign_id]
      .concat(campaignNames.map(function (name) { return touch[name]; }))
      .join('|');
  }
  function updateLastSignificant(touch) {
    if (!isSignificant(touch)) return false;
    var previous = {
      landing_page: memory.last_touch_landing_page,
      utm_referrer: memory.last_touch_referrer,
      yclid: memory.last_touch_yclid,
      campaign_id: memory.last_touch_campaign_id
    };
    campaignNames.forEach(function (name) { previous[name] = memory['last_touch_' + name]; });
    if (lastSignature(previous) === lastSignature(touch)) return false;
    memory.last_touch_at = touch.visited_at;
    memory.last_touch_landing_page = touch.landing_page;
    memory.last_touch_referrer = touch.utm_referrer;
    memory.last_touch_yclid = touch.yclid;
    memory.last_touch_campaign_id = touch.campaign_id;
    campaignNames.forEach(function (name) { memory['last_touch_' + name] = touch[name]; });
    return true;
  }
  function touch() {
    var current = currentTouch(), changed = false;
    if (!memory) {
      try { memory = JSON.parse(window.localStorage.getItem(key)); } catch (_) {}
    }
    if (!memory || !memory.visited_at || !Number.isFinite(Date.parse(memory.visited_at)) || Date.now() - Date.parse(memory.visited_at) > 90 * 86400000) {
      memory = current;
      changed = true;
    } else {
      if (!memory.attribution_version) { memory.attribution_version = '2'; changed = true; }
      if (!memory.ym_uid && current.ym_uid) { memory.ym_uid = current.ym_uid; changed = true; }
    }
    if (evaluatedLocation !== window.location.href && updateLastSignificant(current)) changed = true;
    evaluatedLocation = window.location.href;
    if (changed) save();
    return memory;
  }
  function save() { try { window.localStorage.setItem(key, JSON.stringify(memory)); } catch (_) {} }
  function requestClientId() {
    attempts += 1;
    if (typeof window.ym === 'function') {
      try {
        window.ym(18246130, 'getClientID', function (value) {
          clientId = digits(value);
          if (clientId && !touch().client_id) { memory.client_id = clientId; save(); }
        });
      } catch (_) {}
    } else if (attempts < 20) setTimeout(requestClientId, 100);
  }
  touch();
  requestClientId();
  window.SG.orderAttribution = {
    context: function () {
      var result = {}, original = touch();
      storedNames.forEach(function (name) {
        if (typeof original[name] === 'string') result[name] = original[name];
      });
      var id = digits(original.client_id) || clientId || digits(original.ym_uid) || cookie();
      if (id) result.client_id = id;
      var ymUid = digits(original.ym_uid) || cookie();
      if (ymUid) result.ym_uid = ymUid;
      return result;
    }
  };
})();
