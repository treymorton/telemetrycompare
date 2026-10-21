const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file:///home/dell01/telemetry-compare/index.html');
  const F = (process.env.TEST_A || require('path').resolve(__dirname, 'testData/PW714260-82DRYL4-hwinfo.CSV'));
  await (await page.$('#fileA')).uploadFile(F);
  await (await page.$('#fileB')).uploadFile(F);
  await page.waitForFunction(() => document.getElementById('metaB').textContent.includes('rows'));
  await page.type('#fnameA', 'Pro Precision 7 14');
  await page.type('#fnameB', 'Test Bench 2');
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#colrows .colrow')];
    const tick = (n, cls) => rows.find(r => r.querySelector('.cname').textContent === n).querySelector('.' + cls + ' input').click();
    tick('Core Usage (avg) [%]', 'cbA'); tick('Core Clocks (avg) [MHz]', 'cbA'); tick('Total CPU Usage [%]', 'cbA');
    tick('Core Usage (avg) [%]', 'cbB'); tick('Total CPU Usage [%]', 'cbB');
  });
  await new Promise(r => setTimeout(r, 300));
  const legend = await page.evaluate(() =>
    [...document.querySelectorAll('#legend .lgroup')].map(g => ({
      title: g.querySelector('.lgtitle').textContent,
      color: getComputedStyle(g.querySelector('.lgtitle')).color,
      items: [...g.querySelectorAll('.item span:last-child')].map(s => s.textContent),
    })));
  console.log('legend groups:', JSON.stringify(legend, null, 1));

  // export with stubbed picker
  await page.evaluate(() => {
    window.showSaveFilePicker = async (opts) => {
      const chunks = [];
      return { name: opts.suggestedName, createWritable: () => ({
        write: async (b) => { chunks.push(b); },
        close: async () => {
          const blob = new Blob(chunks);
          window.__pngB64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
        } }) };
    };
  });
  await page.click('#exportbtn');
  await page.waitForFunction(() => window.__pngB64, { timeout: 5000 });
  fs.writeFileSync('export-fname.png', Buffer.from(await page.evaluate(() => window.__pngB64), 'base64'));
  // tooltip shows friendly name?
  const box = await page.$eval('#chart', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(box.x + box.w * 0.6, box.y + box.h * 0.5);
  await new Promise(r => setTimeout(r, 200));
  console.log('tooltip:', (await page.evaluate(() => document.getElementById('tooltip').textContent)).slice(0, 200));
  await page.screenshot({ path: 'e2e-fname.png' });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
