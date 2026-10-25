#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');
var source = fs.readFileSync(path.join(__dirname, '..', 'sweetgift-live-popup.js'), 'utf8');
var articleKey = 'sg_article_popup_rotation_v1';
var oldKey = 'sg_live_popup_rotation_v1';
var sessionKey = 'sg_live_popup_shown_v6';
var product = { product_key: '/catalog/tproduct/123-real', title: 'Реальный товар', views: 2 };

function runtime(options) {
  options = options || {};
  var local = options.local || {};
  var session = options.session || {};
  var tasks = [];
  var calls = [];
  var nodes = [];
  var head = [];
  var close;

  function storage(values) {
    return {
      getItem: function (key) { return Object.hasOwn(values, key) ? values[key] : null; },
      setItem: function (key, value) { values[key] = String(value); }
    };
  }
  function unavailable() { throw new Error('Storage unavailable'); }
  var document = {
    readyState: 'complete',
    head: { appendChild: function (node) { head.push(node); } },
    body: {
      appendChild: function (node) { nodes.push(node); },
      contains: function (node) { return nodes.includes(node); }
    },
    getElementById: function (id) { return head.find(function (node) { return node.id === id; }); },
    querySelector: function () { return options.occupied ? {} : nodes[0] || null; },
    createElement: function () {
      var node = {
        classList: { add: function () {}, remove: function () {} },
        querySelector: function () {
          return { addEventListener: function (event, callback) { close = callback; } };
        },
        remove: function () { nodes.splice(nodes.indexOf(node), 1); }
      };
      return node;
    }
  };
  var window = {
    location: { pathname: options.pathname || '/stati/example', search: options.search || '' },
    SG: { core: { supabase: function (callback) {
      callback({ rpc: function (name) {
        calls.push(name);
        if (options.rpcReject) return Promise.reject(new Error('Offline'));
        return Promise.resolve({ data: options.products || [product], error: options.rpcError || null });
      } });
    } } }
  };
  var context = {
    window: window, document: document, console: console,
    localStorage: options.localBlocked ? { getItem: unavailable, setItem: unavailable } : storage(local),
    sessionStorage: options.sessionBlocked ? { getItem: unavailable, setItem: unavailable } : storage(session),
    setTimeout: function (callback, delay) { tasks.push({ callback: callback, delay: delay }); }
  };
  vm.runInNewContext(source, context, { filename: 'sweetgift-live-popup.js' });
  return {
    local: local, session: session, nodes: nodes, calls: calls, tasks: tasks,
    run: async function () {
      var first = tasks.shift();
      if (first) first.callback();
      for (var i = 0; i < 4; i++) await Promise.resolve();
    },
    close: function () { close({ preventDefault: function () {}, stopPropagation: function () {} }); }
  };
}

async function run() {
  var local = {};
  for (var cycle = 0; cycle < 2; cycle++) {
    for (var slot = 0; slot < 4; slot++) {
      var visit = runtime({ local: local });
      assert.equal(visit.tasks[0].delay, 12000);
      await visit.run();
      assert.equal(visit.nodes.length, 1);
      var popup = visit.nodes[0];
      if (slot === 0) {
        assert.match(popup.innerHTML, /BOOK/);
        assert.match(popup.innerHTML, /на любую композицию при заказе сегодня/);
        assert.equal(popup.href, '/');
      } else if (slot < 3) {
        var url = new URL(popup.href, 'https://sweetgift.ru');
        assert.equal(url.pathname, slot === 1 ? '/podbor-po-sostavu' : '/podbor-podarka');
        assert.equal(url.searchParams.get('utm_source'), 'stati');
        assert.equal(url.searchParams.get('utm_medium'), 'popup');
        assert.equal(url.searchParams.get('utm_campaign'), 'article_rotation');
        assert.equal(url.searchParams.get('utm_content'), slot === 1 ? 'composition' : 'gift_quiz');
        if (slot === 2) assert.match(popup.innerHTML, /быстро и удобно/);
      } else {
        assert.equal(popup.href, product.product_key);
      }
      assert.equal(visit.calls.length, slot === 3 ? 1 : 0);
      assert.equal(local[articleKey], String((slot + 1) % 4));
      assert.equal(local[oldKey], undefined);
      assert.equal(visit.session[sessionKey], '1');
      assert.ok(visit.tasks.some(function (task) { return task.delay === 25000; }));
      var nextPage = runtime({ local: local, session: visit.session, pathname: '/stati/second' });
      assert.equal(nextPage.tasks.length, 0);
      visit.close();
      assert.ok(visit.tasks.some(function (task) { return task.delay === 400; }));
    }
  }

  for (var options of [{ products: [] }, { rpcError: { message: 'Unavailable' } }, { rpcReject: true }]) {
    var failedLocal = { [articleKey]: '3' };
    var failed = runtime(Object.assign({ local: failedLocal }, options));
    await failed.run();
    assert.equal(failed.nodes.length, 0);
    assert.equal(failedLocal[articleKey], '3');
    assert.equal(failed.session[sessionKey], undefined);
  }
  for (var value of ['invalid', '-1', '4', '1.5', 'Infinity']) {
    var corrupt = runtime({ local: { [articleKey]: value } });
    await corrupt.run();
    assert.match(corrupt.nodes[0].innerHTML, /BOOK/);
  }
  var occupied = runtime({ occupied: true });
  await occupied.run();
  assert.equal(occupied.local[articleKey], undefined);
  assert.equal(occupied.session[sessionKey], undefined);

  var blocked = runtime({ localBlocked: true, sessionBlocked: true });
  await blocked.run();
  assert.match(blocked.nodes[0].innerHTML, /BOOK/);

  for (var pathname of ['/', '/stati', '/stati/', '/catalog', '/stati-other/example', '/podbor-podarka']) {
    var ordinary = runtime({ pathname: pathname, local: { [oldKey]: '3', [articleKey]: '2' } });
    await ordinary.run();
    assert.equal(ordinary.nodes[0].href, pathname === '/podbor-podarka' ? product.product_key : '/podbor-podarka');
    assert.equal(ordinary.local[articleKey], '2');
  }
  var ordinaryProduct = runtime({ pathname: '/catalog' });
  await ordinaryProduct.run();
  assert.equal(ordinaryProduct.nodes[0].href, product.product_key);
  var nested = runtime({ pathname: '/stati/topic/example/' });
  await nested.run();
  assert.match(nested.nodes[0].innerHTML, /BOOK/);
  var preview = runtime({ search: '?testpopup=quiz', session: { [sessionKey]: '1' } });
  assert.equal(preview.tasks[0].delay, 1000);
  await preview.run();
  assert.equal(preview.nodes[0].href, '/podbor-podarka');
  assert.equal(preview.local[articleKey], undefined);
  console.log('live-popup: article cycles, UTM, session limit, unavailable activity/storage, close and ordinary pages passed');
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
