#!/usr/bin/env node

'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var vm = require('node:vm');
var path = require('node:path');

var source = fs.readFileSync(
  path.join(__dirname, '..', 'sweetgift-article-products.js'),
  'utf8'
);

function Element(className, alias) {
  this.nodeType = 1;
  this.className = className || '';
  this.dataset = {};
  if (alias !== undefined) this.dataset.alias = alias;
  this.attributes = {};
  this.children = [];
  this.innerHTML = '';
  this.isConnected = true;
  this.id = '';
  this.textContent = '';
}

Element.prototype.matches = function (selector) {
  return selector === '.sg-related-products' &&
    this.className.split(/\s+/).indexOf('sg-related-products') !== -1;
};

Element.prototype.querySelectorAll = function (selector) {
  var result = [];

  this.children.forEach(function visit(child) {
    if (child.matches(selector)) result.push(child);
    child.children.forEach(visit);
  });

  return result;
};

Element.prototype.setAttribute = function (name, value) {
  this.attributes[name] = String(value);
};

Element.prototype.getAttribute = function (name) {
  return Object.prototype.hasOwnProperty.call(this.attributes, name)
    ? this.attributes[name]
    : null;
};

Element.prototype.appendChild = function (child) {
  this.children.push(child);
  return child;
};

function createRuntime(options) {
  var root = new Element();
  var head = new Element();
  var containers = options.containers || [];
  root.children = containers.slice();
  var observers = [];
  var calls = [];
  var attempts = {};
  var storage = {};

  var document = {
    readyState: 'complete',
    documentElement: root,
    head: head,
    querySelectorAll: function (selector) {
      return root.querySelectorAll(selector);
    },
    getElementById: function (id) {
      return head.children.find(function (child) {
        return child.id === id;
      }) || null;
    },
    createElement: function () {
      return new Element();
    },
    addEventListener: function () {}
  };

  function MutationObserver(callback) {
    this.callback = callback;
    observers.push(this);
  }

  MutationObserver.prototype.observe = function () {};
  MutationObserver.prototype.disconnect = function () {};

  function schedule(callback, delay) {
    if (delay >= 5000) return setImmediate(callback);
    Promise.resolve().then(callback);
    return null;
  }

  function cancelSchedule(id) {
    if (id) clearImmediate(id);
  }

  var context = {
    window: {
      setTimeout: schedule,
      clearTimeout: cancelSchedule,
      location: {
        origin: 'https://sweetgift.ru',
        pathname: options.pathname || '/stati/current-url-alias'
      },
      sessionStorage: {
        getItem: function (key) {
          return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
        },
        setItem: function (key, value) {
          storage[key] = String(value);
        }
      },
      SG: {
        core: {
          rpc: function (name, params, success, failure) {
            calls.push({ name: name, alias: params.article_alias });
            var alias = params.article_alias;
            attempts[alias] = (attempts[alias] || 0) + 1;

            Promise.resolve().then(function () {
              if (
                options.hangCounts &&
                attempts[alias] <= (options.hangCounts[alias] || 0)
              ) {
                return;
              }
              if (
                options.errorCounts &&
                attempts[alias] <= (options.errorCounts[alias] || 0)
              ) {
                failure(new Error('Temporary RPC error'));
                return;
              }
              if (options.errors && options.errors[alias]) {
                failure(new Error(options.errors[alias]));
                return;
              }
              success(Object.prototype.hasOwnProperty.call(options.responses || {}, alias)
                ? options.responses[alias]
                : null);
            });
          }
        }
      }
    },
    document: document,
    MutationObserver: MutationObserver,
    URL: URL,
    Intl: Intl,
    Promise: Promise,
    Map: Map,
    Date: Date,
    isFinite: isFinite,
    setTimeout: schedule,
    clearTimeout: cancelSchedule,
    console: console
  };

  vm.runInNewContext(source, context, { filename: 'sweetgift-article-products.js' });

  return {
    calls: calls,
    observer: observers[0],
    add: function (node) {
      root.children.push(node);
      this.observer.callback([{ addedNodes: [node] }]);
    },
    notify: function (node) {
      this.observer.callback([{ addedNodes: [node] }]);
    }
  };
}

function response(alias, products) {
  return {
    alias: alias,
    title: 'Корзины <для статьи>',
    subtitle: 'Безопасный & полезный список',
    products: products === undefined ? [{
      title: 'Корзина с сыром',
      price: 7000,
      url: '/catalog/syr',
      image: 'https://static.tildacdn.com/syr.jpg'
    }] : products,
    navigation: []
  };
}

function settle() {
  return new Promise(function (resolve) {
    setImmediate(resolve);
  });
}

async function run() {
  var modern = new Element('sg-related-products', 'data-alias-wins');
  var modernRuntime = createRuntime({
    pathname: '/stati/url-must-not-win',
    containers: [modern],
    responses: { 'data-alias-wins': response('data-alias-wins') }
  });
  await settle();
  assert.deepEqual(modernRuntime.calls.map(function (call) { return call.alias; }), ['data-alias-wins']);
  assert.equal(modern.getAttribute('data-sg-state'), 'loaded');

  var legacy = new Element('sg-related-products');
  var emptyAlias = new Element('sg-related-products', '   ');
  var fallbackRuntime = createRuntime({
    pathname: '/stati/legacy-alias/',
    containers: [legacy, emptyAlias],
    responses: { 'legacy-alias': response('legacy-alias') }
  });
  await settle();
  assert.equal(fallbackRuntime.calls.length, 1);
  assert.equal(legacy.getAttribute('data-sg-state'), 'loaded');
  assert.equal(emptyAlias.getAttribute('data-sg-state'), 'loaded');

  var first = new Element('sg-related-products', 'first-alias');
  var second = new Element('sg-related-products', 'second-alias');
  var multipleRuntime = createRuntime({
    containers: [first, second],
    responses: {
      'first-alias': response('first-alias'),
      'second-alias': response('second-alias')
    }
  });
  await settle();
  assert.deepEqual(
    multipleRuntime.calls.map(function (call) { return call.alias; }).sort(),
    ['first-alias', 'second-alias']
  );

  var duplicateOne = new Element('sg-related-products', 'same-alias');
  var duplicateTwo = new Element('sg-related-products', 'same-alias');
  var duplicateRuntime = createRuntime({
    containers: [duplicateOne, duplicateTwo],
    responses: { 'same-alias': response('same-alias') }
  });
  await settle();
  assert.equal(duplicateRuntime.calls.length, 1);
  assert.equal(duplicateOne.getAttribute('data-sg-state'), 'loaded');
  assert.equal(duplicateTwo.getAttribute('data-sg-state'), 'loaded');

  var unknown = new Element('sg-related-products', 'unknown-alias');
  var empty = new Element('sg-related-products', 'empty-alias');
  var error = new Element('sg-related-products', 'error-alias');
  createRuntime({
    containers: [unknown, empty, error],
    responses: {
      'unknown-alias': null,
      'empty-alias': response('empty-alias', [])
    },
    errors: { 'error-alias': 'Test RPC error' }
  });
  await settle();
  assert.equal(unknown.getAttribute('data-sg-state'), 'empty');
  assert.equal(unknown.innerHTML.includes('пока нет подходящих'), true);
  assert.equal(empty.getAttribute('data-sg-state'), 'empty');
  assert.equal(empty.innerHTML.includes('пока нет подходящих'), true);
  assert.equal(error.getAttribute('data-sg-state'), 'error');
  assert.equal(error.innerHTML.includes('Не удалось загрузить'), true);

  var retry = new Element('sg-related-products', 'retry-alias');
  var retryRuntime = createRuntime({
    containers: [retry],
    responses: { 'retry-alias': response('retry-alias') },
    errorCounts: { 'retry-alias': 2 }
  });
  await settle();
  assert.equal(retryRuntime.calls.length, 3);
  assert.equal(retry.getAttribute('data-sg-state'), 'loaded');

  var timeoutRetry = new Element('sg-related-products', 'timeout-retry-alias');
  var timeoutRetryRuntime = createRuntime({
    containers: [timeoutRetry],
    responses: { 'timeout-retry-alias': response('timeout-retry-alias') },
    hangCounts: { 'timeout-retry-alias': 1 }
  });
  await settle();
  await settle();
  assert.equal(timeoutRetryRuntime.calls.length, 2);
  assert.equal(timeoutRetry.getAttribute('data-sg-state'), 'loaded');

  var unresolved = new Element('sg-related-products');
  var unresolvedRuntime = createRuntime({
    pathname: '/not-an-article/',
    containers: [unresolved],
    responses: {}
  });
  await settle();
  assert.equal(unresolvedRuntime.calls.length, 0);
  assert.equal(unresolved.getAttribute('data-sg-state'), null);

  var dynamicRuntime = createRuntime({ responses: { dynamic: response('dynamic') } });
  var wrapper = new Element();
  var dynamic = new Element('sg-related-products', 'dynamic');
  wrapper.children.push(dynamic);
  dynamicRuntime.add(wrapper);
  await settle();
  assert.equal(dynamic.getAttribute('data-sg-state'), 'loaded');
  dynamicRuntime.notify(dynamic);
  await settle();
  assert.equal(dynamicRuntime.calls.length, 1);

  var unsafe = new Element('sg-related-products', 'unsafe');
  createRuntime({
    containers: [unsafe],
    responses: {
      unsafe: {
        alias: 'unsafe',
        title: '<img src=x onerror=alert(1)>',
        subtitle: '<script>alert(1)</script>',
        products: [
          null,
          {
            title: '<svg onload=alert(1)>',
            price: 'not-a-number',
            url: 'javascript:alert(1)',
            image: 'data:image/svg+xml,<svg onload=alert(1)>'
          }
        ],
        navigation: [
          null,
          { title: '<b>bad</b>', url: 'javascript:alert(1)' }
        ]
      }
    }
  });
  await settle();
  assert.equal(unsafe.getAttribute('data-sg-state'), 'loaded');
  assert.equal(unsafe.innerHTML.includes('javascript:'), false);
  assert.equal(unsafe.innerHTML.includes('data:image'), false);
  assert.equal(unsafe.innerHTML.includes('<script>'), false);
  assert.equal(unsafe.innerHTML.includes('<svg'), false);
  assert.equal(unsafe.innerHTML.includes('&lt;svg onload=alert(1)&gt;'), true);

  console.log('article-products: 13 сценариев успешно');
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
