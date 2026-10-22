const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','sweetgift-order-attribution.js'),'utf8');
const trackerSource=fs.readFileSync(path.join(__dirname,'..','sweetgift-order-tracker.js'),'utf8');
function setup({url='https://sweetgift.ru/catalog?yclid=9876543210123456789&utm_source=yandex&utm_medium=cpc&utm_campaign=123456789',store=new Map(),blocked=false,client='1234567890123456789',host}={}){
  const listeners={},calls=[],values=store,timers=[],form={tagName:'FORM',tildaOrderId:'T202610-1234567890',elements:[],getAttribute:()=> 'y',closest:()=>null,querySelector(selector){const name=selector.match(/name="([^"]+)"/)[1];return this.elements.find(f=>f.name===name)||null;},appendChild(f){this.elements.push(f);}};
  const window={location:new URL(url),localStorage:{getItem:k=>{if(blocked)throw Error();return values.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error();values.set(k,v);}},sessionStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},tcart:{products:[{name:'Gift',quantity:1,price:1200}],amount:1200},SG:{core:{rpc:(name,payload,success)=>{calls.push({name,payload});success({ok:true});}}},ym:(counter,method,callback)=>{assert.equal(counter,18246130);assert.equal(method,'getClientID');if(client)callback(client);}};
  if(host)window.location=new URL('https://'+host);
  const document={cookie:'_ym_uid=1234567890123456789',referrer:'',title:'catalog',createElement:()=>({setAttribute(k,v){this[k]=v;}}),addEventListener:(name,fn)=>listeners[name]=fn,querySelector:()=>form};
  const context={window,document,URL,URLSearchParams,WeakMap,Date,setTimeout:fn=>timers.push(fn),console};vm.runInNewContext(source,context);
  return {window,document,listeners,calls,form,context,values};
}
test('uses getClientID string and captures first yclid, UTM, visit and clean landing',()=>{
  const f=setup({url:'https://sweetgift.ru/catalog?yclid=9876543210123456789&utm_source=yandex&utm_medium=cpc&utm_campaign=123456789&phone=79991234567'}),a=f.window.SG.orderAttribution.context();
  assert.equal(a.client_id,'1234567890123456789');assert.equal(a.yclid,'9876543210123456789');assert.equal(a.utm_campaign,'123456789');assert.equal(a.campaign_id,undefined);assert.equal(a.landing_page,'https://sweetgift.ru/catalog');assert.ok(Number.isFinite(Date.parse(a.visited_at)));assert.doesNotMatch(JSON.stringify(a),/79991234567/);
});
test('return via internal/direct navigation keeps the original source and ClientID',()=>{
  const first=setup(),original=JSON.stringify(first.window.SG.orderAttribution.context()),second=setup({url:'https://sweetgift.ru/cart?utm_source=internal',store:first.values,client:'1111111111111111'});
  assert.equal(JSON.stringify(second.window.SG.orderAttribution.context()),original);
});
test('blocked storage still preserves first-touch context through checkout in memory',()=>{
  const f=setup({blocked:true});f.window.location=new URL('https://sweetgift.ru/cart');assert.equal(f.window.SG.orderAttribution.context().utm_source,'yandex');
});
test('does not fabricate identity when counter/cookie unavailable',()=>{
  const f=setup({client:null});f.document.cookie='';const a=f.window.SG.orderAttribution.context();assert.equal(a.client_id,undefined);assert.equal(a.ym_uid,undefined);
});
test('does not run on an admin/API/foreign host',()=>{
  const f=setup({host:'api.sweetgift.ru'});assert.equal(f.window.SG.orderAttribution,undefined);
});
test('real tracker sends attribution with the successful order to existing Supabase RPC',()=>{
  const f=setup();vm.runInNewContext(trackerSource,f.context);f.listeners.submit({target:f.form});f.listeners['tildaform:aftersuccess']({target:f.form});
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'track_product_order');assert.equal(f.calls[0].payload.p_order.order_id,'T202610-1234567890');assert.equal(f.calls[0].payload.p_order.attribution.yclid,'9876543210123456789');assert.equal(f.form.elements.find(f=>f.name==='sg_original_client_id').value,'1234567890123456789');
  f.listeners['tildaform:aftersuccess']({target:f.form});assert.equal(f.calls.length,1);
});
test('missing native order number retains its fallback across duplicate success events',()=>{
  const f=setup();delete f.form.tildaOrderId;vm.runInNewContext(trackerSource,f.context);f.listeners.submit({target:f.form});f.listeners['tildaform:aftersuccess']({target:f.form});const id=f.calls[0].payload.p_order.order_id;
  f.listeners['tildaform:aftersuccess']({target:f.form});assert.equal(f.calls.length,1);assert.equal(f.window.SG.orderTracker.inspect(f.form).order_id,id);
  // Even a late native alias must not silently create a second analytics order.
  f.form.tildaOrderId='T202610-9999999999';f.listeners['tildaform:aftersuccess']({target:f.form});assert.equal(f.calls.length,1);
});
