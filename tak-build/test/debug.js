const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  await page.goto('file:///home/user/TAK-3D-Website.html');
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => ({
    scrollH: document.body.scrollHeight,
    docScrollH: document.documentElement.scrollHeight,
    innerH: innerHeight,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    scrollingEl: document.scrollingElement === document.body ? 'body' : 'html'
  }));
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(800);
  const s1 = await page.evaluate(() => ({ y1: window.scrollY, bodyScrollTop: document.body.scrollTop, docTop: document.documentElement.scrollTop }));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2200);
  const s2 = await page.evaluate(() => ({
    y: window.scrollY,
    revealed: document.querySelectorAll('[data-reveal].in').length,
    activeSteps: document.querySelectorAll('.t-item.active').length,
    imgLoaded: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth > 0).length
  }));
  console.log(JSON.stringify({ info, s1, s2, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
