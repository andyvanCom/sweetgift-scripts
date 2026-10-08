const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('fs'), assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '..', 'sweetgift-order-photos.js'),'utf8');
const photo = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAIAAUAmJaQAA3AA/vz0AAA=';
const item = n => ({src:'photos/'+String(n).padStart(32,'0')+'.webp',productTitle:'Товар '+n,productUrl:'https://sweetgift.ru/tproduct/123456-product'+n});
(async()=>{
const browser = await chromium.launch({headless:true, executablePath:process.env.WORKSHOP_BROWSER_EXECUTABLE || undefined});
try {
 const page = await browser.newPage({viewport:{width:1100,height:1300}});
 let calls=0, gallery={version:1,items:[item(1),item(2)]}, fail=false;
 await page.route('https://app.sweetgift.ru/order-photos/**', async route => {
  if(route.request().url().endsWith('gallery.json')){ calls++; await route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(gallery)}); }
  else await route.fulfill({contentType:'image/webp',body:Buffer.from(photo.split(',')[1],'base64')});
 });
 await page.clock.install();
 await page.setContent('<div data-sg-order-photos></div><div data-sg-order-photos></div>');
 await page.addScriptTag({content:source});
 await page.waitForFunction(()=>document.querySelectorAll('[data-sg-photos-state="ready"]').length===2);
 assert.equal(calls,1,'shared initial request');
 await page.locator('.sg-pause').first().click();
 gallery={version:1,items:[item(3),item(1),item(2)]};
 await page.clock.fastForward(300001);
 await page.waitForFunction(()=>document.querySelector('.sg-group').children.length===3);
 assert.equal(calls,2,'five-minute timer');
 assert.equal(await page.locator('.sg-pause').first().textContent(),'Продолжить','pause preserved');
 assert.equal(await page.locator('[data-sg-copy] a:not([tabindex="-1"])').count(),0,'copies not tabbable');
 fail=true; await page.clock.fastForward(300001);
 await page.waitForFunction(()=>document.querySelector('.sg-group').children.length===3);
 assert.equal(calls,3); assert.equal(await page.locator('[data-sg-photos-state="error"]').count(),0,'failure keeps gallery');
 fail=false;
 await page.evaluate(()=>document.querySelector('.sg-group a').focus());
 gallery={version:1,items:[item(4)]}; await page.clock.fastForward(300001);
 await new Promise(resolve=>setTimeout(resolve,150));
 assert.equal(await page.locator('.sg-group').first().locator('.sg-card').count(),3,'focus defers update');
 await page.evaluate(()=>document.activeElement.blur());
 await page.clock.fastForward(1000);
 await page.waitForFunction(()=>document.querySelector('.sg-group').children.length===1);
 await page.evaluate(()=>document.querySelectorAll('[data-sg-order-photos]').forEach(node=>node.remove()));
 await page.clock.fastForward(301000); const after=calls; await page.clock.fastForward(301000); assert.equal(calls,after,'detached mounts stop polling');
 await page.close();
 const bare=await browser.newPage();let bareCalls=0;
 await bare.route('https://app.sweetgift.ru/**',route=>{bareCalls++;route.abort()});
 await bare.clock.install();await bare.setContent('<p>Page without gallery</p>');await bare.addScriptTag({content:source});await bare.clock.fastForward(600001);assert.equal(bareCalls,0);
 await bare.close(); console.log('PASS: periodic shared refresh, failure retention, pause, focus deferral, clone links, teardown, no-marker zero requests');
} finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
