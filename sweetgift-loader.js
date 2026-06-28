/*
===========================================================================
SweetGift.ru | Main Scripts Loader
---------------------------------------------------------------------------
Единый загрузчик модулей SweetGift.
В Tilda HEAD подключается только этот файл.
Список модулей берется из sweetgift-manifest.json.
===========================================================================
*/

(function () {
  'use strict';

  var REPO_BASE = 'https://cdn.jsdelivr.net/gh/andyvanCom/sweetgift-scripts@main/';
  var MANIFEST_URL = REPO_BASE + 'sweetgift-manifest.json?v=' + Date.now();

  window.SG = window.SG || {};
  window.SG.loader = window.SG.loader || {};
  window.SG.loader.version = '1.1.0';
  window.SG.loader.loaded = window.SG.loader.loaded || {};

  function log() {
    if (window.SG && window.SG.debug) {
      console.log.apply(console, ['[SG Loader]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function currentPath() {
    return window.location.pathname || '/';
  }

  function isProductPage(path) {
    return path.indexOf('/tproduct/') !== -1;
  }

  function isArticlePage(path) {
    return path.indexOf('/stati/') === 0;
  }

  function isTopPage(path) {
    return path === '/top' || path.indexOf('/top/') === 0;
  }

  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function wildcardToRegExp(rule) {
    var pattern = '^' + String(rule)
      .split('*')
      .map(escapeRegExp)
      .join('.*') + '$';

    return new RegExp(pattern);
  }

  function matchPageRule(rule, path) {
    if (!rule) return false;

    if (rule === 'all') return true;
    if (rule === 'products') return isProductPage(path);
    if (rule === 'articles') return isArticlePage(path);
    if (rule === 'top') return isTopPage(path);

    if (rule.indexOf('contains:') === 0) {
      return path.indexOf(rule.replace('contains:', '')) !== -1;
    }

    if (rule === path) return true;

    if (rule.indexOf('*') !== -1) {
      return wildcardToRegExp(rule).test(path);
    }

    return false;
  }

  function shouldLoadModule(module) {
    if (!module || module.enabled !== true) return false;

    if (!module.pages || !module.pages.length) {
      return true;
    }

    var path = currentPath();

    for (var i = 0; i < module.pages.length; i++) {
      if (matchPageRule(module.pages[i], path)) {
        return true;
      }
    }

    return false;
  }

  function loadScript(module) {
    if (!module.src || !module.name) return;

    if (window.SG.loader.loaded[module.name]) {
      log('Already loaded:', module.name);
      return;
    }

    var src = module.src;

    if (src.indexOf('http') !== 0) {
      src = REPO_BASE + src;
    }

    if (module.version) {
      src += (src.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(module.version);
    }

    var script = document.createElement('script');
    script.src = src;
    script.async = module.async !== false;

    script.onload = function () {
      window.SG.loader.loaded[module.name] = true;
      log('Loaded:', module.name);
    };

    script.onerror = function () {
      console.error('[SG Loader] Load error:', module.name, src);
    };

    document.head.appendChild(script);
  }

  function loadModules(manifest) {
    if (!manifest || !manifest.modules || !manifest.modules.length) {
      log('Empty manifest');
      return;
    }

    manifest.modules.forEach(function (module) {
      if (shouldLoadModule(module)) {
        loadScript(module);
      }
    });
  }

  function start() {
    fetch(MANIFEST_URL)
      .then(function (response) {
        return response.json();
      })
      .then(function (manifest) {
        window.SG.loader.manifest = manifest;
        log('Manifest loaded', manifest);
        loadModules(manifest);
      })
      .catch(function (error) {
        console.error('[SG Loader] Manifest error:', error);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();