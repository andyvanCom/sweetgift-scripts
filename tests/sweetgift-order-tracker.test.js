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

function setup(paymentSystem) {
  const listeners = {};
  const rpcCalls = [];
  const ymCalls = [];
  const document = {
    referrer: '',
    addEventListener(name, callback) { listeners[name] = callback; },
    querySelector() { return null; }
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
      return selector.indexOf('paymentsystem') !== -1 ? paymentField : null;
    }
  };
  const window = {
    location: { origin: 'https://sweetgift.ru', href: 'https://sweetgift.ru/' },
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
