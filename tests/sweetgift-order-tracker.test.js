const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'sweetgift-order-tracker.js'),
  'utf8'
);

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function setup(paymentSystem, options = {}) {
  const listeners = {};
  const rpcCalls = [];
  const ymCalls = [];
  const document = {
    referrer: options.referrer || '',
    title: 'SweetGift checkout',
    cookie: '_ym_uid=1778770785599882941; _ga=GA1.1.123456789.1778770785; _fbp=fb.1.test',
    addEventListener(name, callback) { listeners[name] = callback; },
    querySelector() { return null; },
    createElement() {
      return {
        setAttribute(name, value) { this[name] = value; }
      };
    }
  };
  const paymentField = {
    name: 'paymentsystem',
    type: 'radio',
    checked: options.checked !== false,
    disabled: false,
    value: paymentSystem
  };
  const form = {
    tagName: 'FORM',
    tildaOrderId: 'order-42',
    elements: [paymentField],
    getAttribute(name) { return name === 'data-formcart' ? 'y' : null; },
    closest(selector) { return selector === '.t706' ? {} : null; },
    querySelector(selector) {
      const match = selector.match(/^\[name="([^"]+)"\](?::checked)?$/);
      if (!match) return null;
      return this.elements.find((field) => field.name === match[1] &&
        (!selector.endsWith(':checked') || field.checked)) || null;
    },
    appendChild(field) { this.elements.push(field); }
  };
  const window = {
    location: {
      origin: 'https://sweetgift.ru',
      href: options.href || 'https://sweetgift.ru/',
      search: new URL(options.href || 'https://sweetgift.ru/').search,
      pathname: new URL(options.href || 'https://sweetgift.ru/').pathname
    },
    localStorage: storage(),
    sessionStorage: storage(),
    dataLayer: [],
    tcart: {
      products: [{ name: 'Gift', url: '/gift', price: 1000, quantity: 1 }],
      amount: 1000
    },
    ym() {
      ymCalls.push(Array.from(arguments));
      if (options.confirmMetrika !== false) arguments[4]();
    },
    SG: {
      core: {
        rpc(name, payload, success) {
          rpcCalls.push({ name, payload });
          success({ ok: true, inserted_count: 1 });
        }
      }
    }
  };

  vm.runInNewContext(source, {
    window,
    document,
    URL,
    URLSearchParams,
    WeakMap,
    setTimeout,
    console
  });

  return { form, listeners, window, rpcCalls, ymCalls };
}

for (const paymentSystem of [
  'tinkoff', 'cash', 'custom.yandexsplit',
  'Yandex', 'Оплата по счету'
]) {
  test(`sends ${paymentSystem} once after a successful cart form`, () => {
    const env = setup(paymentSystem);

    env.listeners.submit({ target: env.form });
    assert.equal(env.ymCalls.length, 0);
    env.listeners['tildaform:aftersuccess']({ target: env.form });
    env.listeners['tildaform:aftersuccess']({ target: env.form });

    assert.equal(env.window.dataLayer.length, 1);
    assert.deepEqual(
      JSON.parse(JSON.stringify(env.window.dataLayer[0])),
      {
        event: 'checkout_payment_selected',
        PAYMENTSYSTEM: paymentSystem
      }
    );
    assert.equal(env.ymCalls.length, 1);
    assert.deepEqual(
      JSON.parse(JSON.stringify(env.ymCalls[0].slice(0, 4))),
      [
        18246130,
        'reachGoal',
        'checkout_payment_selected',
        { PAYMENTSYSTEM: paymentSystem }
      ]
    );
    assert.equal(env.window.localStorage.getItem('sg_metrika_payment_order-42'), '1');
  });
}

test('does not send a payment event without PAYMENTSYSTEM', () => {
  const env = setup('');

  env.listeners.submit({ target: env.form });
  env.listeners['tildaform:aftersuccess']({ target: env.form });

  assert.equal(env.window.dataLayer.length, 0);
  assert.equal(env.ymCalls.length, 0);
});

test('does not mistake an unchecked radio option for a selected payment method', () => {
  const env = setup('tinkoff', { checked: false });

  env.listeners.submit({ target: env.form });
  env.listeners['tildaform:aftersuccess']({ target: env.form });

  assert.equal(env.ymCalls.length, 0);
  assert.equal(env.window.SG.orderTracker.inspect(env.form).payment_system, null);
});

test('uses the captured choice if Tilda resets radios before aftersuccess', () => {
  const env = setup('cash');

  env.listeners.submit({ target: env.form });
  env.form.elements[0].checked = false;
  env.listeners['tildaform:aftersuccess']({ target: env.form });

  assert.equal(env.ymCalls.length, 1);
  assert.equal(env.ymCalls[0][3].PAYMENTSYSTEM, 'cash');
});

test('does not mark a payment event delivered without a Metrika callback', () => {
  const env = setup('cash', { confirmMetrika: false });

  env.listeners.submit({ target: env.form });
  env.listeners['tildaform:aftersuccess']({ target: env.form });

  assert.equal(env.ymCalls.length, 1);
  assert.equal(env.window.localStorage.getItem('sg_metrika_payment_order-42'), null);
});

test('adds genuine attribution and cart context to the CRM form before submit', () => {
  const env = setup('custom.yandexsplit', {
    href: 'https://sweetgift.ru/fruktovye-korziny/?utm_source=yandex&utm_medium=cpc&yclid=abc123',
    referrer: 'https://yandex.ru/search/'
  });

  env.listeners.submit({ target: env.form });

  const crmFields = Object.fromEntries(
    env.form.elements
      .filter((field) => field['data-sg-crm-field'] === '1')
      .map((field) => [field.name, field.value])
  );

  assert.equal(crmFields.sg_utm_source, 'yandex');
  assert.equal(crmFields.sg_utm_medium, 'cpc');
  assert.equal(crmFields.sg_yclid, 'abc123');
  assert.equal(crmFields.sg_referrer, 'https://yandex.ru/search/');
  assert.equal(crmFields.sg_ym_uid, '1778770785599882941');
  assert.equal(crmFields.sg_ym_counter, '18246130');
  assert.equal(crmFields.sg_ga_client_id, '123456789.1778770785');
  assert.equal(crmFields.sg_fbp, 'fb.1.test');
  assert.equal(crmFields.sg_cart_total, '1000');
  assert.equal(crmFields.sg_cart_product_count, '1');
  assert.match(crmFields.sg_cart_items, /Gift × 1 — 1000/);
});
