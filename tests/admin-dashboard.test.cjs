const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = fs.readFileSync('supabase/functions/admin-dashboard/index.ts', 'utf8');
// Parse the whole server function, then evaluate its actual HTML template.
new vm.Script(stripTypeScriptTypes(source.replace(/^import .*;\n/gm, '')));
const template = source.match(/const HTML = (`[\s\S]*?`);\n/)[1];
const html = vm.runInNewContext(template, {
  ADMIN_URL: 'https://app.sweetgift.ru/sg-admin', PUBLISHABLE_KEY: 'public-test-key',
});
const client = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const session = () => ({access_token: 'test-access', refresh_token: 'test-refresh', expires_at: Date.now()/1000 + 3600});
const dashboard = {orders: {total:0, revenue:0, daily:[], top_products:[], top_categories:[], recent:[]}, pipeline:[], catalog:{products:0, articles:0}, report:''};
const response = (status, data) => ({ok: status < 400, status, json: async () => data});

function browser(saved, fetch) {
  const elements = new Map();
  const storage = new Map(saved === undefined ? [] : [['sg_admin_session', typeof saved === 'string' ? saved : JSON.stringify(saved)]]);
  const element = id => {
    if (!elements.has(id)) {
      const classes = new Set(['hidden']);
      elements.set(id, {value: id === 'period' ? '30' : '', textContent: '', style:{}, disabled:false,
        listeners:{}, addEventListener(event, callback) {this.listeners[event] = callback;}, focus(){},
        classList:{add:x=>classes.add(x), remove:x=>classes.delete(x), contains:x=>classes.has(x), toggle(x,on){on ? classes.add(x) : classes.delete(x);}},
      });
    }
    return elements.get(id);
  };
  const location = {hash:'', reload(){}};
  const context = vm.createContext({fetch, AbortController, TypeError, FormData, URLSearchParams, Intl, Date, setTimeout, clearTimeout,
    window:{location}, location, document:{getElementById:element, querySelectorAll:()=>[]},
    localStorage:{getItem:k=>storage.get(k)||null, setItem:(k,v)=>storage.set(k,v), removeItem:k=>storage.delete(k)},
  });
  vm.runInContext(client, context);
  return {element, storage, run:code=>vm.runInContext(code,context), context};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('successful OTP survives a failed dashboard and retry does not reuse OTP', async () => {
  let verifies=0, reads=0;
  const b=browser(undefined, async url => {
    assert.ok(url.startsWith('https://app.sweetgift.ru/sg-admin/'));
    if (url.endsWith('/auth/verify')) {verifies++; return response(200,session());}
    if (++reads===1) throw new TypeError('Failed to fetch');
    return response(200,dashboard);
  });
  b.element('email').value='admin@example.test'; b.element('otpCode').value='123 456';
  await b.element('codeForm').listeners.submit({preventDefault(){}});
  assert.ok(b.storage.has('sg_admin_session'));
  assert.match(b.element('loginError').textContent,/Вход сохранён/);
  assert.equal(b.element('retryLoad').classList.contains('hidden'),false);
  await b.element('retryLoad').onclick();
  assert.equal(verifies,1); assert.equal(reads,2);
  assert.equal(b.element('app').classList.contains('hidden'),false);
});

test('invalid OTP leaves its form available and stores no session', async () => {
  const b=browser(undefined, async()=>response(403,{msg:'Неверный код'}));
  b.element('email').value='admin@example.test'; b.element('otpCode').value='123456';
  b.element('codeForm').classList.remove('hidden');
  await b.element('codeForm').listeners.submit({preventDefault(){}});
  assert.equal(b.storage.has('sg_admin_session'),false);
  assert.equal(b.element('codeForm').classList.contains('hidden'),false);
  assert.equal(b.element('loginError').textContent,'Неверный код');
});

test('startup server failure preserves session and offers retry', async () => {
  const b=browser(session(), async()=>response(500,{error:'Недоступно'})); await tick();
  assert.ok(b.storage.has('sg_admin_session'));
  assert.equal(b.element('retryLoad').classList.contains('hidden'),false);
});

test('expired refresh rejection clears session and shows email login', async () => {
  const b=browser({...session(),expires_at:0},async()=>response(400,{msg:'Invalid refresh token'})); await tick();
  assert.equal(b.storage.has('sg_admin_session'),false);
  assert.equal(b.element('emailForm').classList.contains('hidden'),false);
});

test('refresh network error preserves existing session', async () => {
  const b=browser({...session(),expires_at:0},async()=>{throw new TypeError('Failed to fetch')}); await tick();
  assert.ok(b.storage.has('sg_admin_session'));
});

test('parallel requests share a single refresh', async () => {
  let refreshes=0;
  const b=browser(undefined,async()=>{refreshes++; await tick();return response(200,session())});
  b.run('saveSession('+JSON.stringify({...session(),expires_at:0})+')');
  await b.run('Promise.all([ensureSession(),ensureSession()])');
  assert.equal(refreshes,1);
});

test('request timeout aborts and releases its timer', async () => {
  let timeoutCallback, cleared=false;
  const b=browser(undefined,(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error(),{name:'AbortError'})))));
  b.context.setTimeout=callback=>{timeoutCallback=callback;return 123};
  b.context.clearTimeout=id=>{assert.equal(id,123);cleared=true};
  const pending=b.run('requestJson("/test",{},15)'); timeoutCallback();
  await assert.rejects(pending,/Сервер не ответил вовремя/); assert.ok(cleared);
});

test('timeout while reading the JSON body is reported as a timeout', async () => {
  let timeoutCallback;
  const b=browser(undefined,async(_,options)=>({ok:true,status:200,json:()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error(),{name:'AbortError'}))))}));
  b.context.setTimeout=callback=>{timeoutCallback=callback;return 1}; b.context.clearTimeout=()=>{};
  const pending=b.run('requestJson("/test")'); await tick(); timeoutCallback();
  await assert.rejects(pending,/Сервер не ответил вовремя/);
});

test('malformed saved session does not break the login screen', () => {
  const b=browser('{broken',async()=>{throw new Error('unexpected request')});
  assert.equal(b.run('state.session'),null);
});

test('Tilda shell is valid JavaScript and uses bounded Russian proxy loading', () => {
  const shell=fs.readFileSync('deploy/admin-shell.html','utf8');
  new vm.Script(shell.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.match(shell,/https:\/\/app\.sweetgift\.ru\/sg-admin\//);
  assert.match(shell,/controller\.abort\(\); \}, 15000/);
  assert.doesNotMatch(shell,/functions\.supabase\.co/);
});
