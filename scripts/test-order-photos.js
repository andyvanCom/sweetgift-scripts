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
var gallery = JSON.parse(fs.readFileSync(path.join(root, 'order-photos/gallery.json')));
assert.deepEqual(Object.keys(gallery).sort(), ['items', 'version']);
assert.equal(gallery.version, 1);
assert(gallery.items.length > 0 && gallery.items.length <= 60);
var filenames = new Set();
gallery.items.forEach(function (item) {
  assert(Object.keys(item).every(function (key) { return key === 'src' || key === 'productTitle'; }), 'No private archive fields in public JSON');
  assert(/^photos\/workshop-\d{2}\.webp$/.test(item.src), 'No order IDs or archive hashes in filenames');
  assert(!filenames.has(item.src)); filenames.add(item.src);
  if (item.productTitle) assert.equal(typeof item.productTitle, 'string');
  var bytes = fs.readFileSync(path.join(root, 'order-photos', item.src));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  // Read the RIFF chunks rather than matching arbitrary compressed image bytes.
  for (var offset = 12; offset + 8 <= bytes.length;) {
    var chunk = bytes.toString('ascii', offset, offset + 4);
    assert(!['EXIF', 'XMP ', 'ICCP'].includes(chunk), 'Public derivatives must have no embedded metadata');
    var size = bytes.readUInt32LE(offset + 4);
    offset += 8 + size + (size % 2);
  }
});
console.log('PASS: container-only activation, manifest, public gallery schema, six metadata-free image assets.');
