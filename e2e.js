const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('file:///home/dell01/telemetry-compare/index.html');
  const A = (process.env.TEST_A || require('path').resolve(__dirname, 'testData/PW714260-82DRYL4-hwinfo.CSV'));
  const B = (process.env.TEST_A || require('path').resolve(__dirname, 'testData/PW714260-82DRYL4-hwinfo.CSV'));  // same logger, second run stand-in
  const C = (process.env.TEST_B || require('path').resolve(__dirname, 'testData/PW714260-82DRYL4-nvperf_log_20261021_074559.csv'));

  for (const [slot, f] of [['fileA', A], ['fileB', B], ['fileC', C]]) {
    const input = await page.$('#' + slot);
    await input.uploadFile(f);
  }
  await page.waitForFunction(() =>
    ['A','B','C'].every(s => document.getElementById('meta'+s).textContent.includes('rows')), { timeout: 15000 });
  const metas = await page.evaluate(() => ['A','B','C'].map(s => document.getElementById('meta'+s).textContent));
  console.log('METAS:'); metas.forEach(m => console.log(' ', JSON.stringify(m)));

  // tick A and B on "Core Usage (avg) [%]", C on "gpu_util_pct"
  const clicked = await page.evaluate(() => {
    const out = [];
    const rows = [...document.querySelectorAll('#collist .colrow')];
    const find = (name) => rows.find(r => r.querySelector('.cname').textContent === name);
    const tick = (name, cls) => {
      const r = find(name);
      if (!r) return out.push(name + ': ROW MISSING');
      const cb = r.querySelector('.' + cls + ' input');
      if (!cb) return out.push(name + ': CB MISSING');
      if (cb.disabled) return out.push(name + '/' + cls + ': DISABLED');
      cb.click(); out.push(name + '/' + cls + ': clicked');
    };
    tick('Core Usage (avg) [%]', 'cbA');
    tick('Core Usage (avg) [%]', 'cbB');
    tick('gpu_util_pct', 'cbC');
    return out;
  });
  console.log('CLICKS:', clicked);
  await new Promise(r => setTimeout(r, 500));

  const state = await page.evaluate(() => ({
    status: document.getElementById('stat-left').textContent,
    legend: [...document.querySelectorAll('#legend .item span:last-child')].map(s => s.textContent),
    xsel: document.getElementById('xcol').value,
    xopts: [...document.getElementById('xcol').options].map(o => o.value).filter(Boolean),
    canvasHasInk: (() => { const c = document.getElementById('chart');
      const ctx = c.getContext('2d'); const d = ctx.getImageData(0,0,c.width,c.height).data;
      let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) ink++;
      return ink; })(),
  }));
  console.log('STATE:', JSON.stringify(state, null, 1));

  // column filter test
  await page.type('#colfilter', 'total cpu');
  await new Promise(r => setTimeout(r, 200));
  const filtered = await page.evaluate(() => document.querySelectorAll('#collist .colrow').length);
  console.log('filter "total cpu" -> rows:', filtered);

  await page.screenshot({ path: 'e2e-screenshot.png' });
  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})();
