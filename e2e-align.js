const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file:///home/dell01/telemetry-compare/index.html');
  const input = await page.$('#fileA');
  await input.uploadFile((process.env.TEST_A || require('path').resolve(__dirname, 'testData/PW714260-82DRYL4-hwinfo.CSV')));
  await page.waitForFunction(() => document.getElementById('metaA').textContent.includes('rows'));
  // also check after scrolling the list (sticky header) and with a filter applied
  const measure = () => page.evaluate(() => {
    const hdrs = [...document.querySelectorAll('.colhdrs .a, .colhdrs .b, .colhdrs .c')].map(e => {
      const r = e.getBoundingClientRect(); return r.x + r.width / 2;
    });
    const row = document.querySelector('#colrows .colrow');
    const cbs = [...row.querySelectorAll('.cbA input, .cbB input, .cbC input')].map(e => {
      const r = e.getBoundingClientRect(); return r.x + r.width / 2;
    });
    return { hdrs: hdrs.map(x => +x.toFixed(1)), cbs: cbs.map(x => +x.toFixed(1)),
             deltas: hdrs.map((h, i) => +(h - cbs[i]).toFixed(1)) };
  });
  console.log('top:', JSON.stringify(await measure()));
  await page.evaluate(() => { document.getElementById('collist').scrollTop = 500; });
  await new Promise(r => setTimeout(r, 100));
  console.log('scrolled:', JSON.stringify(await measure()));
  await page.type('#colfilter', 'clock');
  await new Promise(r => setTimeout(r, 150));
  console.log('filtered:', JSON.stringify(await measure()));
  // click still works after restructure
  const clicked = await page.evaluate(() => {
    const r = document.querySelector('#colrows .colrow');
    const cb = r.querySelector('.cbA input'); cb.click();
    return cb.checked && document.getElementById('stat-left').textContent;
  });
  console.log('click+status:', clicked);
  await page.screenshot({ path: 'e2e-align.png', clip: { x: 0, y: 0, width: 360, height: 900 } });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
