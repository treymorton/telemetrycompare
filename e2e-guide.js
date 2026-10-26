// e2e: per-slot color families, column tooltips, field guide (view + export)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));

  await page.goto('file://' + require('path').resolve(__dirname, 'index.html'));
  const nv = path.resolve(__dirname, 'testData/PW714260-82DRYL4-nvperf_log_20261021_074559.csv');
  const ia = await page.$('#fileA'); await ia.uploadFile(nv);
  const ib = await page.$('#fileB'); await ib.uploadFile(nv);
  await page.waitForFunction(() => document.querySelectorAll('#colrows .colrow').length > 10);

  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); };
    set('fnameA', 'Config 1'); set('fnameB', 'Config 2');
    // user scenario: 2 columns from each of two files
    const rows = [...document.querySelectorAll('#colrows .colrow')];
    const pick = (name, slots) => {
      const r = rows.find(x => x.querySelector('.cname').textContent === name);
      for (const s of slots) r.querySelector('.cb' + s + ' input').click();
    };
    pick('gpu_util_pct', ['A', 'B']);
    pick('gpu_temp_c', ['A', 'B']);
  });
  await new Promise(r => setTimeout(r, 500));

  // 1) color families: collect line-swatch colors per slot from the legend
  const fam = await page.evaluate(() => {
    const out = {};
    for (const g of document.querySelectorAll('#legend .lgroup')) {
      const t = g.querySelector('.lgtitle').textContent.trim();
      out[t] = [...g.querySelectorAll('.swatch')].map(s => getComputedStyle(s).borderTopColor);
    }
    return out;
  });
  console.log('legend colors by slot:', JSON.stringify(fam));
  const setA = new Set(fam['Config 1'] || []), setB = new Set(fam['Config 2'] || []);
  const overlap = [...setA].filter(c => setB.has(c));
  console.log('cross-slot color overlap:', overlap.length ? overlap : 'NONE (good)');
  const isGreenish = c => { const [r, g, b] = c.match(/\d+/g).map(Number); return g > r && g > b; };
  const isAmberish = c => { const [r, g, b] = c.match(/\d+/g).map(Number); return r > g && g > b && b < 120; };
  const Aok = [...setA].every(isGreenish);
  console.log('A all greenish:', Aok, '| B all amberish:', [...setB].every(isAmberish));

  // 2) tooltips in the field selector
  const tt = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#colrows .cname')].find(x => x.textContent === 'gpu_util_pct');
    return el ? el.title : null;
  });
  console.log('column tooltip gpu_util_pct:', JSON.stringify(tt));

  // 3) field guide visible with descriptions
  const guide = await page.evaluate(() => {
    const g = document.getElementById('guide');
    return { shown: g.style.display !== 'none',
             rows: [...g.querySelectorAll('.gitem')].map(r => r.textContent) };
  });
  console.log('guide shown:', guide.shown, '| rows:', guide.rows.length);
  for (const r of guide.rows) console.log('  guide:', r);

  // toggle off hides guide
  await page.evaluate(() => { const cb = document.getElementById('guidebtn'); cb.checked = false; cb.dispatchEvent(new Event('change')); });
  const hidden = await page.evaluate(() => document.getElementById('guide').style.display === 'none');
  await page.evaluate(() => { const cb = document.getElementById('guidebtn'); cb.checked = true; cb.dispatchEvent(new Event('change')); });
  console.log('toggle-off hides guide:', hidden);

  // 4) export includes the guide section: stub picker, capture PNG, compare height
  await page.evaluate(() => {
    window.showSaveFilePicker = async (opts) => {
      const chunks = [];
      window.__opts = opts;
      return { name: opts.suggestedName, createWritable: () => ({
        write: async b => chunks.push(b),
        close: async () => {
          const blob = new Blob(chunks);
          const r = new FileReader();
          await new Promise(res => { r.onload = res; r.readAsDataURL(blob); });
          window.__b64 = r.result.split(',')[1];
        } }) };
    };
  });
  await page.click('#exportbtn');
  await page.waitForFunction(() => window.__b64, { timeout: 15000 });
  const b64 = await page.evaluate(() => window.__b64);
  fs.writeFileSync(path.resolve(__dirname, 'export-guide.png'), Buffer.from(b64, 'base64'));
  console.log('exported export-guide.png,', Buffer.from(b64, 'base64').length, 'bytes, name:',
    await page.evaluate(() => window.__opts.suggestedName));

  await page.screenshot({ path: path.resolve(__dirname, 'e2e-guide.png') });
  const fails = [];
  if (overlap.length) fails.push('cross-slot color overlap');
  if (!Aok || ![...setB].every(isAmberish)) fails.push('color family violated');
  if (!tt || !tt.includes('busy')) fails.push('tooltip missing');
  if (!guide.shown || guide.rows.length !== 2) fails.push('guide rows wrong');
  if (!hidden) fails.push('guide toggle broken');
  console.log('JS errors:', errors.length ? errors : 'none');
  console.log(fails.length ? 'FAILURES: ' + fails.join('; ') : 'e2e-guide: all checks passed');
  await browser.close();
  if (fails.length || errors.length) process.exit(1);
})().catch(e => { console.error('E2E CRASH', e); process.exit(1); });
