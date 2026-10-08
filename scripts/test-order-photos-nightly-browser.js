const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs'), assert = require('node:assert/strict'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'sweetgift-order-photos.js'), 'utf8');
const picture = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAIAAUAmJaQAA3AA/vz0AAA=', 'base64');
const item = n => ({ src: 'photos/' + String(n).padStart(32, '0') + '.webp', productTitle: 'Товар ' + n, productUrl: 'https://sweetgift.ru/tproduct/123456-product' + n });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.WORKSHOP_BROWSER_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1300 } });
    let calls = 0, gallery = { version: 1, items: [item(1), item(2)] };
    await page.route('https://app.sweetgift.ru/order-photos/**', async route => {
      if (route.request().url().endsWith('gallery.json')) {
        calls++;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(gallery) });
      } else await route.fulfill({ contentType: 'image/webp', body: picture });
    });
    await page.clock.install();
    await page.setContent('<div data-sg-order-photos></div><div data-sg-order-photos></div>');
    await page.addScriptTag({ content: source });
    await page.waitForFunction(() => document.querySelectorAll('[data-sg-photos-state="ready"]').length === 2);
    assert.equal(calls, 1, 'one shared initial request');
    await page.locator('.sg-pause').first().click();
    gallery = { version: 1, items: [item(3)] };
    await page.clock.fastForward(86400001);
    assert.equal(calls, 1, 'no polling even when the page stays open for a day');
    assert.equal(await page.locator('.sg-group').first().locator('.sg-card').count(), 2);
    assert.equal(await page.locator('.sg-pause').first().textContent(), 'Продолжить');
    assert.equal(await page.locator('[data-sg-copy] a:not([tabindex="-1"])').count(), 0);
    // Opening a fresh page loads the latest server collection.
    await page.goto('about:blank');
    await page.setContent('<div data-sg-order-photos></div>');
    await page.addScriptTag({ content: source });
    await page.waitForFunction(() => document.querySelector('[data-sg-photos-state="ready"]'));
    assert.equal(calls, 2);
    assert.equal(await page.locator('.sg-group').first().locator('.sg-card').count(), 1);
    await page.close();
    const bare = await browser.newPage();
    let bareCalls = 0;
    await bare.route('https://app.sweetgift.ru/**', route => { bareCalls++; route.abort(); });
    await bare.clock.install();
    await bare.setContent('<p>Page without gallery</p>');
    await bare.addScriptTag({ content: source });
    await bare.clock.fastForward(86400001);
    assert.equal(bareCalls, 0);
    await bare.close();
    console.log('PASS: shared load, zero polling for 24 hours, fresh page gets updated collection, pause and no-marker behavior');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
