const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'sweetgift-gift-quiz.js'), 'utf8');

function requestedCore(scriptSrc, dataset = {}) {
  let appended;
  const document = {
    currentScript: { src: scriptSrc, dataset },
    readyState: 'complete',
    createElement() { return {}; },
    querySelectorAll() { return []; },
    head: { appendChild(node) { appended = node; } },
  };
  const window = { SG: {} };
  vm.runInNewContext(source, {
    URL,
    document,
    location: { href: 'https://sweetgift.ru/podbor-podarka' },
    window,
  });
  return appended && appended.src;
}

test('loads quiz core from the same immutable commit as the quiz module', () => {
  assert.equal(
    requestedCore('https://cdn.jsdelivr.net/gh/andyvanCom/sweetgift-scripts@abc123/sweetgift-gift-quiz.js?v=14'),
    'https://cdn.jsdelivr.net/gh/andyvanCom/sweetgift-scripts@abc123/gift-quiz-core.v1.js',
  );
});

test('honours an explicit quiz core override', () => {
  assert.equal(
    requestedCore('https://example.test/sweetgift-gift-quiz.js', { quizCore: 'https://assets.example.test/core.js' }),
    'https://assets.example.test/core.js',
  );
});

function quizRuntime(options = {}) {
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const calls = [];
  const events = [];
  const listeners = {};
  function schedule(fn, delay, interval = 0) {
    const id = ++nextTimer;
    timers.set(id, { fn, at: now + delay, interval });
    return id;
  }
  function advance(ms) {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      const [id, timer] = due;
      now = timer.at;
      if (timer.interval) timer.at += timer.interval;
      else timers.delete(id);
      timer.fn();
    }
    now = end;
  }
  function node() {
    return {
      innerHTML: '', textContent: '', className: '', dataset: {}, attributes: {}, listeners: {},
      addEventListener(name, fn) { this.listeners[name] = fn; },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      appendChild() {},
    };
  }
  const elements = Object.fromEntries(['questions', 'active', 'guide', 'live', 'results', 'note', 'share', 'proposal'].map(k => [k, node()]));
  const root = node();
  root.dataset = { limit: '4', showAll: '6' };
  root.querySelector = sel => ({
    '.sg-gq-questions': elements.questions, '.sg-gq-active': elements.active,
    '.sg-gq-guide': elements.guide, '.sg-gq-live': elements.live, '.sg-gq-results': elements.results,
  })[sel];
  elements.results.querySelector = sel => ({
    '.sg-gq-note': elements.note, '.sg-gq-share-root': elements.share, '.sg-kp-root': elements.proposal,
  })[sel];
  const location = { href: 'https://sweetgift.ru/podbor-podarka?gift_type=basket&diet=no_pork' };
  const core = {
    rpc() {},
    rpcRead(name, params, success, failure) {
      const call = { name, params, success, failure, aborted: false };
      calls.push(call);
      return { abort() { call.aborted = true; failure({ name: 'AbortError' }); } };
    },
  };
  if (options.legacy) {
    core.rpc = core.rpcRead;
    delete core.rpcRead;
  }
  const window = {
    SG: { core, share: { create() { return node(); } } },
    crypto: { randomUUID() { return 'quiz-test'; } },
    addEventListener(name, fn) { listeners[name] = fn; },
  };
  const document = {
    currentScript: { src: 'https://cdn.example.test/sweetgift-gift-quiz.js', dataset: {} },
    readyState: 'complete', head: { appendChild() {} }, body: {},
    getElementById() { return true; },
    querySelectorAll() { return [root]; },
    dispatchEvent(event) { events.push(event); },
  };
  const context = vm.createContext({
    URL, URLSearchParams, document, window, location,
    history: { replaceState(_, __, url) { location.href = new URL(url, location.href).href; } },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    Date: { now() { return now; } },
    setTimeout: (fn, ms) => schedule(fn, ms), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => schedule(fn, ms, ms), clearInterval: id => timers.delete(id),
    MutationObserver: function () { this.observe = () => {}; },
    CustomEvent: function (type, init) { this.type = type; this.detail = init.detail; },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gift-quiz-core.v1.js'), 'utf8'), context);
  vm.runInContext(source, context);
  return {
    ...elements, calls, events, advance,
    change(query) { location.href = 'https://sweetgift.ru/podbor-podarka' + query; listeners.popstate(); },
    retry() { elements.results.listeners.click({ target: { closest: sel => sel === '.sg-gq-retry' ? {} : null } }); },
    pendingTimers() { return timers.size; },
  };
}
const product = { product_key: '/catalog/test', title: 'Тестовая корзина', price: 5000, reasons: [] };
const result = { products: [product], total: 1 };

test('uses the read-only form transport with intact JSON answers', () => {
  const app = quizRuntime();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].name, 'get_gift_quiz_recommendations');
  const answers = JSON.parse(app.calls[0].params.p_answers);
  assert.equal(answers.gift_type, 'basket');
  assert.deepEqual(answers.diet, ['no_pork']);
  assert.equal(app.calls[0].params.p_limit, 6);
});

test('keeps waiting beyond 15 seconds and renders a response after 45 seconds', () => {
  const app = quizRuntime();
  app.advance(45000);
  assert.match(app.live.textContent, /Продолжаем ждать/);
  assert.match(app.live.textContent, /45 сек/);
  assert.doesNotMatch(app.results.innerHTML, /Повторить подбор/);
  app.calls[0].success(result);
  assert.match(app.results.innerHTML, /Тестовая корзина/);
  assert.equal(app.pendingTimers(), 0);
});

test('times out after a minute, cancels the read, retries once and ignores its late response', () => {
  const app = quizRuntime();
  app.advance(60000);
  assert.equal(app.calls[0].aborted, true);
  assert.match(app.live.textContent, /Готовим повторную попытку/);
  app.advance(1500);
  assert.equal(app.calls.length, 2);
  app.calls[0].success({ products: [product], total: 99 });
  assert.doesNotMatch(app.results.innerHTML, /99/);
  app.calls[1].success(result);
  assert.match(app.results.innerHTML, /Тестовая корзина/);
  assert.equal(app.pendingTimers(), 0);
});

test('stops after two attempts and offers a manual retry', () => {
  const app = quizRuntime();
  app.advance(121500);
  assert.equal(app.calls.length, 2);
  assert.ok(app.calls.every(call => call.aborted));
  assert.match(app.results.innerHTML, /Повторить подбор/);
  assert.equal(app.pendingTimers(), 0);
  app.retry();
  assert.equal(app.calls.length, 3);
  app.calls[2].success(result);
  assert.match(app.results.innerHTML, /Тестовая корзина/);
});

test('retries a network failure but does not retry a permanent HTTP error', () => {
  const app = quizRuntime();
  app.calls[0].failure(new TypeError('Failed to fetch'));
  app.advance(1500);
  assert.equal(app.calls.length, 2);
  app.calls[1].success(result);
  const rejected = quizRuntime();
  rejected.calls[0].failure({ status: 400 });
  rejected.advance(121500);
  assert.equal(rejected.calls.length, 1);
  assert.match(rejected.results.innerHTML, /Повторить подбор/);
});

test('changing answers cancels the previous read and clearing gift type cancels its retry', () => {
  const app = quizRuntime();
  app.change('?gift_type=box');
  assert.equal(app.calls[0].aborted, true);
  app.calls[0].success(result);
  assert.doesNotMatch(app.results.innerHTML, /Тестовая корзина/);
  app.calls[1].failure({ status: 503 });
  app.change('');
  app.advance(121500);
  assert.equal(app.calls.length, 2);
  assert.equal(app.pendingTimers(), 0);
  assert.match(app.results.innerHTML, /Выберите направление/);
  app.calls[1].success(result);
  assert.match(app.results.innerHTML, /Выберите направление/);
});

test('retains previous cards with a warning and a retry after refresh failure', () => {
  const app = quizRuntime();
  app.calls[0].success(result);
  app.change('?gift_type=box');
  app.calls[1].failure({ status: 503 });
  app.advance(1500);
  app.calls[2].failure({ status: 503 });
  assert.match(app.results.innerHTML, /Тестовая корзина/);
  assert.match(app.live.textContent, /предыдущие варианты/);
  assert.match(app.note.innerHTML, /Повторить подбор/);
  assert.equal(app.pendingTimers(), 0);
});

test('rpcRead preserves HTTP status, uses a simple form request and can abort it', async () => {
  const requests = [];
  const window = { SG: {}, AbortController };
  const document = { readyState: 'loading', addEventListener() {} };
  const coreSource = fs.readFileSync(path.join(__dirname, '..', 'sweetgift-core.js'), 'utf8');
  vm.runInNewContext(coreSource, {
    window, document, URLSearchParams, console,
    fetch(url, options) {
      requests.push({ url, options });
      return Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve('{"code":"PGRST100","message":"Bad input"}') });
    },
  });
  const error = await new Promise(resolve => {
    const controller = window.SG.core.rpcRead('get_gift_quiz_recommendations', {
      p_answers: JSON.stringify({ gift_type: 'basket', diet: ['no_pork'] }), p_limit: 6,
    }, () => assert.fail('Unexpected success'), resolve);
    assert.equal(typeof controller.abort, 'function');
    controller.abort();
  });
  assert.equal(error.status, 400);
  assert.equal(error.code, 'PGRST100');
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, undefined);
  assert.equal(request.options.headers.apikey, undefined);
  assert.equal(request.options.headers['Content-Type'], 'application/x-www-form-urlencoded;charset=UTF-8');
  const form = new URLSearchParams(request.options.body);
  assert.deepEqual(JSON.parse(form.get('p_answers')), { gift_type: 'basket', diet: ['no_pork'] });
  assert.equal(request.options.signal.aborted, true);
});
