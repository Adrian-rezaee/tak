const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto('file:///home/user/TAK-3D-Website.html');
  await page.waitForTimeout(3800);
  // smooth incremental scroll to bottom
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y <= h; y += 450) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 90));
    }
  });
  await page.waitForTimeout(2500);
  const r1 = await page.evaluate(() => ({
    revealed: document.querySelectorAll('[data-reveal].in').length,
    revealTotal: document.querySelectorAll('[data-reveal]').length,
    activeSteps: document.querySelectorAll('.t-item.active').length,
    counterSample: document.querySelector('[data-count]') ? document.querySelector('[data-count]').textContent : null,
    navActive: (document.querySelector('.nav-links a.active')||{}).textContent
  }));
  // drag test on canvas
  const before = await page.evaluate(() => 0);
  await page.mouse.move(1000, 450);
  await page.mouse.down();
  await page.mouse.move(1120, 480, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  // testimonial next
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.waitForTimeout(600);
  // form submit test (navigate to contact)
  await page.evaluate(() => document.getElementById('contact').scrollIntoView());
  await page.waitForTimeout(800);
  await page.fill('#f-name', 'Test User');
  await page.fill('#f-email', 'test@test.com');
  await page.fill('#f-msg', 'Hello from the smoke test');
  await page.click('#contact-form button[type=submit]');
  await page.waitForTimeout(1600);
  const r2 = await page.evaluate(() => ({
    successVisible: !document.getElementById('form-success').hidden,
    formHidden: document.getElementById('contact-form').hidden
  }));
  // screenshots for pixel analysis
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shot-desktop.png' });
  // portrait mobile
  const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mp.goto('file:///home/user/TAK-3D-Website.html');
  await mp.waitForTimeout(3800);
  await mp.screenshot({ path: 'shot-mobile.png' });
  const r3 = await mp.evaluate(() => ({
    tak3dReady: !!window.__tak3dReady, noWebgl: document.body.classList.contains('no-webgl'),
    canvasW: document.getElementById('hero-canvas').width,
    burgerVisible: getComputedStyle(document.querySelector('.burger')).display !== 'none'
  }));
  console.log(JSON.stringify({ r1, r2, r3, errors: errors.slice(0,15) }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
