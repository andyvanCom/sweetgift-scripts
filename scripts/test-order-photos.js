'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');
var root = path.join(__dirname, '..');
var source = fs.readFileSync(path.join(root, 'sweetgift-order-photos.js'), 'utf8');

function withoutContainer(readyState) {
  var callbacks = {};
  var fetches = 0, styles = 0;
  var document = {
    currentScript: { src: 'https://cdn.jsdelivr.net/gh/andyvanCom/sweetgift-scripts@abc123/sweetgift-order-photos.js?v=1' },
    readyState: readyState,
    body: {},
    head: { appendChild: function () { styles++; } },
    querySelectorAll: function () { return []; },
    addEventListener: function (event, callback) { callbacks[event] = callback; }
  };
  var window = {};
  function Observer() {}
  Observer.prototype.observe = function () {};
  vm.runInNewContext(source, {
    document: document, window: window, URL: URL,
    MutationObserver: Observer, AbortController: AbortController,
    fetch: function () { fetches++; throw new Error('Must not fetch without a container'); },
    setTimeout: setTimeout, clearTimeout: clearTimeout
  });
  if (callbacks.DOMContentLoaded) callbacks.DOMContentLoaded();
  window.SG.orderPhotos.scan();
  assert.equal(fetches, 0, 'No gallery or photo requests on unrelated pages');
  assert.equal(styles, 0, 'No styles inserted on unrelated pages');
}
withoutContainer('complete');
withoutContainer('loading');

var manifest = JSON.parse(fs.readFileSync(path.join(root, 'sweetgift-manifest.json')));
var module = manifest.modules.find(function (item) { return item.name === 'order-photos'; });
assert(module && module.enabled && module.src === 'sweetgift-order-photos.js');
assert(source.includes('https://app.sweetgift.ru/order-photos/gallery.json'));
assert(!fs.existsSync(path.join(root, 'order-photos/gallery.json')), 'No order photo data in public code repository');
console.log('PASS: container-only activation, manifest and own API gallery URL.');
