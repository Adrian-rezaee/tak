const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  await page.goto('file:///home/user/TAK-3D-Website.html');
  await page.waitForTimeout(4000);
  const result = await page.evaluate(() => ({
    takReady: !!window.__takReady,
    tak3dReady: !!window.__tak3dReady,
    noWebgl: document.body.classList.contains('no-webgl'),
    loaded: document.body.classList.contains('loaded'),
    sections: document.querySelectorAll('main section[id]').length,
    navLinks: document.querySelectorAll('.nav-links a').length,
    workCards: document.querySelectorAll('.work-card').length,
    serviceCards: document.querySelectorAll('.service-card').length,
    teamCards: document.querySelectorAll('.team-card').length,
    blogCards: document.querySelectorAll('.blog-card').length,
    tItems: document.querySelectorAll('.t-item').length,
    tSlides: document.querySelectorAll('.tslide').length,
    canvasW: (document.getElementById('hero-canvas')||{}).width,
    canvasH: (document.getElementById('hero-canvas')||{}).height,
    dots: document.querySelectorAll('.tdots button').length,
    imgTotal: document.querySelectorAll('img').length,
    imgLoaded: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth > 0).length,
    fonts: document.fonts ? [...document.fonts].filter(f => f.status === 'loaded').length : -1
  }));
  // scroll to bottom to trigger reveals/counters
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({
    revealed: document.querySelectorAll('[data-reveal].in').length,
    revealTotal: document.querySelectorAll('[data-reveal]').length,
    counters: [...document.querySelectorAll('[data-count]')].map(e => e.textContent),
    activeSteps: document.querySelectorAll('.t-item.active').length
  }));
  console.log(JSON.stringify({ result, after, errors: errors.slice(0, 20) }, null, 2));
  await page.screenshot({ path: '/home/user/tak-build/test/hero.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
