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
    checked: true,
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
      const match = selector.match(/^\[name="([^"]+)"\]$/);
      if (match) return this.elements.find((field) => field.name === match[1]) || null;
      return selector.indexOf('paymentsystem') !== -1 ? paymentField : null;
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
    ym() { ymCalls.push(Array.from(arguments)); },
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

test('sends the confirmed payment system once per order', () => {
  const env = setup('custom.yandexsplit');

  env.listeners.submit({ target: env.form });
  env.listeners['tildaform:aftersuccess']({ target: env.form });
  env.listeners['tildaform:aftersuccess']({ target: env.form });

  assert.equal(env.window.dataLayer.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(env.window.dataLayer[0])),
    {
      event: 'checkout_payment_selected',
      PAYMENTSYSTEM: 'custom.yandexsplit'
    }
  );
  assert.equal(env.ymCalls.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(env.ymCalls[0])),
    [
      18246130,
      'reachGoal',
      'checkout_payment_selected',
      { PAYMENTSYSTEM: 'custom.yandexsplit' }
    ]
  );
});

test('does not send a payment event without PAYMENTSYSTEM', () => {
  const env = setup('');

  env.listeners.submit({ target: env.form });
  env.listeners['tildaform:aftersuccess']({ target: env.form });

  assert.equal(env.window.dataLayer.length, 0);
  assert.equal(env.ymCalls.length, 0);
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
