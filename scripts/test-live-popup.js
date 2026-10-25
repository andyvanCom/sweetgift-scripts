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
  var now = 0;
  var shown = [];
  var hidden = [];

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
      appendChild: function (node) { nodes.push(node); shown.push({ time: now, node: node }); },
      contains: function (node) { return nodes.includes(node); }
    },
    getElementById: function (id) { return head.find(function (node) { return node.id === id; }); },
    querySelector: function () { return options.occupied ? {} : nodes[0] || null; },
    createElement: function () {
      var node = {
        classList: { add: function () {}, remove: function () { hidden.push(now); } },
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
    setTimeout: function (callback, delay) { tasks.push({ callback: callback, delay: delay, due: now + delay }); }
  };
  vm.runInNewContext(source, context, { filename: 'sweetgift-live-popup.js' });
  return {
    local: local, session: session, nodes: nodes, calls: calls, tasks: tasks, shown: shown, hidden: hidden,
    init: function () { window.SG.livePopup.init(); },
    advance: async function (duration) {
      var target = now + duration;
      while (true) {
        tasks.sort(function (a, b) { return a.due - b.due; });
        if (!tasks.length || tasks[0].due > target) break;
        var task = tasks.shift();
        now = task.due;
        task.callback();
        for (var i = 0; i < 4; i++) await Promise.resolve();
      }
      now = target;
    },
    run: async function () {
      tasks.sort(function (a, b) { return a.due - b.due; });
      if (tasks.length) await this.advance(tasks[0].due - now);
    },
    close: function () { close({ preventDefault: function () {}, stopPropagation: function () {} }); }
  };
}

async function run() {
  function checkPopup(popup, slot, section) {
    section = section || 'stati';
    if (slot === 0) {
      assert.match(popup.innerHTML, /BOOK/);
      assert.match(popup.innerHTML, /на любую композицию при заказе сегодня/);
      assert.equal(popup.href, '/');
    } else if (slot < 3) {
      var url = new URL(popup.href, 'https://sweetgift.ru');
      assert.equal(url.pathname, slot === 1 ? '/podbor-po-sostavu' : '/podbor-podarka');
      assert.equal(url.searchParams.get('utm_source'), section);
      assert.equal(url.searchParams.get('utm_medium'), 'popup');
      assert.equal(url.searchParams.get('utm_campaign'), section === 'povod' ? 'povod_rotation' : 'article_rotation');
      assert.equal(url.searchParams.get('utm_content'), slot === 1 ? 'composition' : 'gift_quiz');
      if (slot === 2) assert.match(popup.innerHTML, /быстро и удобно/);
    } else {
      assert.equal(popup.href, product.product_key);
    }
  }

  for (var section of ['stati', 'povod']) {
    var local = {};
    for (var cycle = 0; cycle < 2; cycle++) {
      for (var slot of [0, 2]) {
        var visit = runtime({ pathname: '/' + section + '/example', local: local, session: { [sessionKey]: '1' } });
        assert.equal(visit.tasks[0].delay, 12000);
        visit.init();
        assert.equal(visit.tasks.length, 1);
        await visit.advance(11999);
        assert.equal(visit.shown.length, 0);
        await visit.advance(1);
        assert.equal(visit.nodes.length, 1);
        checkPopup(visit.nodes[0], slot, section);
        assert.equal(visit.shown[0].time, 12000);
        assert.equal(local[articleKey], String(slot + 1));
        await visit.advance(24999);
        assert.equal(visit.hidden.length, 0);
        await visit.advance(1);
        assert.deepEqual(visit.hidden, [37000]);
        await visit.advance(29999);
        assert.equal(visit.nodes.length, 0);
        assert.equal(visit.shown.length, 1);
        await visit.advance(1);
        checkPopup(visit.nodes[0], slot + 1, section);
        assert.equal(visit.shown[1].time, 67000);
        assert.equal(local[articleKey], String((slot + 2) % 4));
        await visit.advance(25000);
        assert.deepEqual(visit.hidden, [37000, 92000]);
        await visit.advance(120000);
        assert.equal(visit.shown.length, 2);
        assert.equal(visit.nodes.length, 0);
        assert.equal(visit.calls.length, slot === 2 ? 1 : 0);
        assert.equal(local[oldKey], undefined);
        assert.equal(visit.session[sessionKey], '1');
        var nextSection = section === 'stati' ? 'povod' : 'stati';
        var nextPage = runtime({ local: Object.assign({}, local), session: visit.session, pathname: '/' + nextSection + '/second' });
        await nextPage.run();
        checkPopup(nextPage.nodes[0], (slot + 2) % 4, nextSection);
      }
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
  await blocked.advance(55000);
  checkPopup(blocked.nodes[0], 1);

  var earlyClose = runtime();
  await earlyClose.run();
  earlyClose.close();
  await earlyClose.advance(54999);
  assert.equal(earlyClose.nodes.length, 0);
  await earlyClose.advance(1);
  assert.equal(earlyClose.shown[1].time, 67000);

  var failedSecond = runtime({ local: { [articleKey]: '2' }, rpcReject: true });
  await failedSecond.advance(200000);
  assert.equal(failedSecond.shown.length, 1);
  assert.equal(failedSecond.local[articleKey], '3');

  for (var pathname of ['/', '/stati', '/stati/', '/povod', '/povod/', '/catalog', '/stati-other/example', '/povod-other/example', '/podbor-podarka']) {
    var ordinary = runtime({ pathname: pathname, local: { [oldKey]: '3', [articleKey]: '2' } });
    await ordinary.run();
    assert.equal(ordinary.nodes[0].href, pathname === '/podbor-podarka' ? product.product_key : '/podbor-podarka');
    assert.equal(ordinary.local[articleKey], '2');
  }
  var ordinaryProduct = runtime({ pathname: '/catalog' });
  await ordinaryProduct.run();
  assert.equal(ordinaryProduct.nodes[0].href, product.product_key);
  var limited = runtime({ pathname: '/catalog', session: { [sessionKey]: '1' } });
  assert.equal(limited.tasks.length, 0);
  var nested = runtime({ pathname: '/stati/topic/example/' });
  await nested.run();
  assert.match(nested.nodes[0].innerHTML, /BOOK/);
  var preview = runtime({ search: '?testpopup=quiz', session: { [sessionKey]: '1' } });
  assert.equal(preview.tasks[0].delay, 1000);
  await preview.run();
  assert.equal(preview.nodes[0].href, '/podbor-podarka');
  assert.equal(preview.local[articleKey], undefined);
  console.log('live-popup: stati/povod teasers at 12s/67s, 25s duration, 30s gap, shared rotation, section UTM, errors and ordinary pages passed');
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
