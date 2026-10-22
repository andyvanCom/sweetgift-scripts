/* Checkout attribution only. No customer/contact data and no conversion sending. */
(function () {
  'use strict';
  if (!/^(www\.)?sweetgift\.ru$/.test(window.location.hostname || new URL(window.location.href).hostname)) return;
  window.SG = window.SG || {};
  var key = 'sg_order_attribution_v1', memory, clientId, attempts = 0;
  var names = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  function digits(value) { return typeof value === 'string' && /^\d{6,30}$/.test(value) ? value : null; }
  function cookie() {
    var match = String(document.cookie || '').match(/(?:^|;\s*)_ym_uid=(\d{6,30})(?:;|$)/);
    return match ? match[1] : null;
  }
  function touch() {
    if (memory) return memory;
    try { memory = JSON.parse(window.localStorage.getItem(key)); } catch (_) {}
    if (!memory || !memory.visited_at || Date.now() - Date.parse(memory.visited_at) > 90 * 86400000) {
      var url = new URL(window.location.href), query = url.searchParams;
      memory = { visited_at: new Date().toISOString(), landing_page: url.origin + url.pathname };
      names.concat(['yclid']).forEach(function (name) {
        var value = query.get(name);
        if (value) memory[name] = value.trim().slice(0, 300);
      });
      var campaign = query.get('campaign_id');
      if (/^\d{1,20}$/.test(campaign || '')) memory.campaign_id = campaign;
      save();
    }
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
      names.concat(['yclid', 'campaign_id', 'visited_at', 'landing_page']).forEach(function (name) {
        if (typeof original[name] === 'string') result[name] = original[name];
      });
      var id = digits(original.client_id) || clientId || cookie();
      if (id) result.client_id = id;
      if (cookie()) result.ym_uid = cookie();
      return result;
    }
  };
})();
