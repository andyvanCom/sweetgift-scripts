/* SweetGift.ru | Real workshop order photos v1
 * Render only inside [data-sg-order-photos]. Public reviewed derivatives only.
 */
(function () {
  'use strict';
  var SELECTOR = '[data-sg-order-photos]';
  window.SG = window.SG || {};
  if (window.SG.orderPhotos) { window.SG.orderPhotos.scan(); return; }
  var scriptUrl = document.currentScript && document.currentScript.src;
  if (!scriptUrl) return;
  var galleryUrl = new URL('order-photos/gallery.json', scriptUrl).href;
  var galleryPromise;
  var STYLE = [
    "  [data-sg-orders], [data-sg-orders] * { box-sizing: border-box; }",
    "  [data-sg-orders] {",
    "    --sg-accent: #b22945;",
    "    --sg-ink: #302b29;",
    "    --sg-muted: #716865;",
    "    --sg-gap: 18px;",
    "    padding: 58px 0 44px;",
    "    background: #fbf8f4;",
    "    color: var(--sg-ink);",
    "    font-family: 'TildaSans', Arial, sans-serif;",
    "    overflow: hidden;",
    "  }",
    "  [data-sg-orders] .sg-intro { max-width: 1200px; margin: 0 auto 28px; padding: 0 32px; }",
    "  [data-sg-orders] .sg-eyebrow {",
    "    margin: 0 0 12px; color: var(--sg-accent); font-size: 12px;",
    "    line-height: 1.5; letter-spacing: .14em; font-weight: 700; text-transform: uppercase;",
    "  }",
    "  [data-sg-orders] .sg-heading { margin: 0 0 15px; font-size: clamp(28px, 3.5vw, 42px); font-weight: 600; line-height: 1.14; letter-spacing: -.025em; }",
    "  [data-sg-orders] .sg-description { max-width: 820px; margin: 0; font-size: 16px; line-height: 1.65; color: var(--sg-muted); }",
    "  [data-sg-orders] .sg-controls { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 22px; }",
    "  [data-sg-orders] .sg-hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--sg-muted); }",
    "  [data-sg-orders] .sg-pause {",
    "    appearance: none; font: inherit; font-size: 12px; font-weight: 600; white-space: nowrap;",
    "    cursor: pointer; padding: 10px 16px; border: 1px solid #ded5d0; border-radius: 30px;",
    "    color: var(--sg-ink); background: transparent; min-height: 40px;",
    "  }",
    "  [data-sg-orders] .sg-pause:hover { background: #f0e8e1; }",
    "  [data-sg-orders] .sg-viewport:focus-visible, [data-sg-orders] .sg-pause:focus-visible { outline: 2px solid var(--sg-accent); outline-offset: 4px; }",
    "  [data-sg-orders] .sg-viewport {",
    "    width: 100%; overflow-x: auto; overflow-y: hidden; scrollbar-width: none;",
    "    overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch;",
    "    padding: 4px 0 8px; scroll-behavior: auto; cursor: grab;",
    "  }",
    "  [data-sg-orders] .sg-viewport::-webkit-scrollbar { display: none; }",
    "  [data-sg-orders] .sg-track { display: flex; width: max-content; }",
    "  [data-sg-orders] .sg-group { display: flex; gap: var(--sg-gap); padding-right: var(--sg-gap); flex: none; }",
    "  [data-sg-orders] .sg-card {",
    "    width: clamp(240px, 25vw, 310px); flex: none; margin: 0;",
    "    border-radius: 16px; overflow: hidden; background: #eee9e3;",
    "  }",
    "  [data-sg-orders] .sg-photo {",
    "    width: 100%; aspect-ratio: 4 / 5; display: block; object-fit: contain;",
    "    background: #eee9e3; user-select: none; -webkit-user-drag: none;",
    "  }",
    "  [data-sg-orders] .sg-name { margin: 0; padding: 14px 16px; font-size: 14px; line-height: 1.45; color: var(--sg-ink); }",
    "  [data-sg-orders] .sg-footer { max-width: 1200px; margin: 21px auto 0; padding: 0 32px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }",
    "  [data-sg-orders] .sg-footer p { margin: 0; font-size: 13px; line-height: 1.65; color: var(--sg-muted); }",
    "  [data-sg-orders] .sg-footer strong { font-weight: 600; color: var(--sg-ink); }",
    "  @media (max-width: 640px) {",
    "    [data-sg-orders] { padding: 36px 0 30px; --sg-gap: 12px; }",
    "    [data-sg-orders] .sg-intro { padding: 0 20px; margin-bottom: 19px; }",
    "    [data-sg-orders] .sg-description { font-size: 14px; line-height: 1.65; }",
    "    [data-sg-orders] .sg-controls { align-items: flex-start; margin-top: 18px; }",
    "    [data-sg-orders] .sg-card { width: min(72vw, 280px); }",
    "    [data-sg-orders] .sg-footer { grid-template-columns: 1fr; gap: 12px; padding: 0 20px; margin-top: 17px; }",
    "    [data-sg-orders] .sg-footer p { font-size: 12px; }",
    "  }"
  ].join('\n');
  var MARKUP = [
    "<section data-sg-orders aria-label=\"Реальные фото заказов SweetGift\">",
    "  <div class=\"sg-intro\">",
    "    <p class=\"sg-eyebrow\">Из нашей мастерской</p>",
    "    <h2 class=\"sg-heading\">Так выглядят реальные заказы</h2>",
    "    <p class=\"sg-description\">Это живые фотографии, которые наши мастера делают после сборки и отправляют арт-директору для контроля качества. Обычные рабочие кадры — чтобы вы могли увидеть, как выглядят подарки, собранные вручную.</p>",
    "    <div class=\"sg-controls\">",
    "      <p class=\"sg-hint\">Снимки в случайном порядке · можно листать</p>",
    "      <button class=\"sg-pause\" type=\"button\" aria-pressed=\"false\">Приостановить</button>",
    "    </div>",
    "  </div>",
    "  <div class=\"sg-viewport\" tabindex=\"0\" role=\"region\" aria-label=\"Лента фотографий; используйте стрелки влево и вправо для просмотра\">",
    "    <div class=\"sg-track\"><div class=\"sg-group\" role=\"list\"></div></div>",
    "  </div>",
    "  <div class=\"sg-footer\">",
    "    <p><strong>Перед отправкой.</strong> Если на фото ещё нет защитной плёнки или транспортировочного пакета, мы добавляем их после съёмки и передаём заказ курьеру.</p>",
    "    <p><strong>С заботой о конфиденциальности.</strong> Мы не раскрываем, кому принадлежит заказ, его номер и дату. Здесь — только фотографии самих композиций.</p>",
    "  </div>",
    "  <noscript><p class=\"sg-description sg-intro\">Для просмотра фотографий включите JavaScript в браузере.</p></noscript>",
    "</section>"
  ].join('\n');

  function loadGallery() {
    if (galleryPromise) return galleryPromise;
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 10000);
    galleryPromise = fetch(galleryUrl, { signal: controller.signal, credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('Gallery unavailable');
        return response.json();
      })
      .then(function (data) {
        if (!data || data.version !== 1 || !Array.isArray(data.items)) throw new Error('Invalid gallery');
        var items = data.items.slice(0, 60).filter(function (item) {
          return item && typeof item.src === 'string' && /^photos\/[a-z0-9-]+\.webp$/.test(item.src);
        }).map(function (item) {
          return { src: item.src, productTitle: typeof item.productTitle === 'string' ? item.productTitle.slice(0, 120) : '' };
        });
        if (!items.length) throw new Error('Empty gallery');
        return items;
      })
      .catch(function (error) { galleryPromise = null; throw error; })
      .finally(function () { clearTimeout(timeout); });
    return galleryPromise;
  }

  function ensureStyles() {
    if (document.getElementById('sg-order-photos-style')) return;
    var style = document.createElement('style');
    style.id = 'sg-order-photos-style'; style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function render(mount, items) {
    mount.innerHTML = MARKUP;
    var root = mount.querySelector('[data-sg-orders]');
    var configuredSpeed = Number(mount.getAttribute('data-speed'));
    var SPEED = configuredSpeed > 0 && configuredSpeed <= 40 ? configuredSpeed : 14;
    var viewport = root.querySelector('.sg-viewport');
    var track = root.querySelector('.sg-track');
    var group = root.querySelector('.sg-group');
    var button = root.querySelector('.sg-pause');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var paused = reduced.matches, visible = true, hover = false, interacting = false;
    var resumeAt = 0, previous = 0, position = 0, cycle = 0, frame;

    // Fisher–Yates: новый случайный порядок при каждом открытии страницы.
    var photos = items.slice();
    for (var i = photos.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var value = photos[i]; photos[i] = photos[j]; photos[j] = value;
    }
    photos.forEach(function (photo) {
      var figure = document.createElement('figure');
      figure.className = 'sg-card'; figure.setAttribute('role', 'listitem');
      var image = document.createElement('img');
      image.className = 'sg-photo'; image.src = new URL(photo.src, galleryUrl).href;
      image.alt = photo.productTitle ? photo.productTitle + ' — фото из мастерской SweetGift' : 'Реальная композиция, собранная в мастерской SweetGift';
      image.decoding = 'async'; image.draggable = false;
      figure.appendChild(image);
      if (photo.productTitle) {
        var caption = document.createElement('figcaption');
        caption.className = 'sg-name'; caption.textContent = photo.productTitle;
        figure.appendChild(caption);
      }
      group.appendChild(figure);
    });
    function measure() {
      track.querySelectorAll('[data-sg-copy]').forEach(function (copy) { copy.remove(); });
      cycle = group.getBoundingClientRect().width;
      if (!cycle) return;
      // Хвост покрывает даже очень широкий экран и короткую подборку.
      var copies = Math.ceil(viewport.clientWidth / cycle) + 1;
      for (var n = 0; n < copies; n++) {
        var copy = group.cloneNode(true);
        copy.dataset.sgCopy = 'true'; copy.setAttribute('aria-hidden', 'true');
        copy.removeAttribute('role');
        copy.querySelectorAll('img').forEach(function (image) { image.alt = ''; });
        track.appendChild(copy);
      }
      position = viewport.scrollLeft % cycle; viewport.scrollLeft = position;
    }
    function buttonState() {
      button.textContent = paused ? 'Продолжить' : 'Приостановить';
      button.setAttribute('aria-pressed', String(paused));
    }
    function manual() {
      resumeAt = performance.now() + 5000;
      position = viewport.scrollLeft;
    }
    button.addEventListener('click', function () { paused = !paused; buttonState(); });
    viewport.addEventListener('pointerenter', function (event) { if (event.pointerType === 'mouse') hover = true; });
    viewport.addEventListener('pointerleave', function () { hover = false; interacting = false; manual(); });
    viewport.addEventListener('pointerdown', function () { interacting = true; manual(); });
    function pointerUp() { if (interacting) { interacting = false; manual(); } }
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    viewport.addEventListener('wheel', manual, { passive: true });
    viewport.addEventListener('touchstart', manual, { passive: true });
    viewport.addEventListener('touchend', manual, { passive: true });
    viewport.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      if (event.key === 'ArrowLeft' && viewport.scrollLeft < 1) viewport.scrollLeft = cycle;
      viewport.scrollLeft += (event.key === 'ArrowRight' ? 1 : -1) * (group.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(root).getPropertyValue('--sg-gap')));
      manual();
    });
    var intersectionObserver, resizeObserver;
    if ('IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; });
      intersectionObserver.observe(root);
    }
    if ('ResizeObserver' in window) { resizeObserver = new ResizeObserver(measure); resizeObserver.observe(viewport); }
    else window.addEventListener('resize', measure);
    function preferenceChanged() { paused = reduced.matches; buttonState(); }
    if (reduced.addEventListener) reduced.addEventListener('change', preferenceChanged);
    else reduced.addListener(preferenceChanged);

    function animate(now) {
      if (!root.isConnected) {
        cancelAnimationFrame(frame);
        if (intersectionObserver) intersectionObserver.disconnect();
        if (resizeObserver) resizeObserver.disconnect();
        window.removeEventListener('resize', measure);
        window.removeEventListener('pointerup', pointerUp);
        window.removeEventListener('pointercancel', pointerUp);
        if (reduced.removeEventListener) reduced.removeEventListener('change', preferenceChanged);
        else reduced.removeListener(preferenceChanged);
        return;
      }
      var seconds = previous ? Math.min((now - previous) / 1000, .05) : 0;
      previous = now;
      if (!paused && visible && !document.hidden && !hover && !interacting && now >= resumeAt && document.activeElement !== viewport && cycle > 0) {
        position = (position + SPEED * seconds) % cycle;
        viewport.scrollLeft = position;
      } else position = viewport.scrollLeft;
      frame = requestAnimationFrame(animate);
    }
    measure(); buttonState(); frame = requestAnimationFrame(animate);

  }

  function init(mount) {
    if (!mount || !mount.matches(SELECTOR) || mount.getAttribute('data-sg-photos-state')) return;
    mount.setAttribute('data-sg-photos-state', 'loading');
    ensureStyles();
    var loading = document.createElement('p');
    loading.setAttribute('role', 'status');
    loading.textContent = 'Загружаем фотографии из мастерской…';
    mount.appendChild(loading);
    loadGallery().then(function (items) {
      if (!mount.isConnected) { mount.removeAttribute('data-sg-photos-state'); return; }
      render(mount, items);
      mount.setAttribute('data-sg-photos-state', 'ready');
    }).catch(function () {
      mount.textContent = '';
      mount.setAttribute('data-sg-photos-state', 'error');
      var status = document.createElement('p');
      status.setAttribute('role', 'status'); status.textContent = 'Не удалось загрузить фотографии.';
      var retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = 'Повторить';
      retry.addEventListener('click', function () {
        mount.textContent = ''; mount.removeAttribute('data-sg-photos-state'); init(mount);
      });
      mount.appendChild(status); mount.appendChild(retry);
    });
  }
  function scan() { document.querySelectorAll(SELECTOR).forEach(init); }
  function start() {
    scan();
    // Handle containers added by Tilda later, without loading photos elsewhere.
    new MutationObserver(function (changes) {
      changes.forEach(function (change) {
        change.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches(SELECTOR)) init(node);
          node.querySelectorAll(SELECTOR).forEach(init);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.SG.orderPhotos = { version: '1', init: init, scan: scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
