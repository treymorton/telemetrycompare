const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + require('path').resolve(__dirname, 'index.html'));
  await (await page.$('#fileA')).uploadFile((process.env.TEST_A || require('path').resolve(__dirname, 'testData/PW714260-82DRYL4-hwinfo.CSV')));
  await (await page.$('#fileB')).uploadFile((process.env.TEST_A || require('path').resolve(__dirname, 'testData/PW714260-82DRYL4-hwinfo.CSV')));
  await page.waitForFunction(() => document.getElementById('metaB').textContent.includes('rows'));
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#colrows .colrow')];
    const tick = (n, cls) => rows.find(r => r.querySelector('.cname').textContent === n).querySelector('.' + cls + ' input').click();
    tick('Core Usage (avg) [%]', 'cbA');
    tick('Total CPU Usage [%]', 'cbB');
  });
  await new Promise(r => setTimeout(r, 300));

  // 1) picker path: stub showSaveFilePicker, confirm called + write flow works end to end
  await page.evaluate(() => {
    window.__picked = null;
    window.showSaveFilePicker = async (opts) => {
      window.__picked = { name: opts.suggestedName, types: opts.types.map(t => t.accept['image/png']) };
      const chunks = [];
      return {
        name: opts.suggestedName,
        createWritable: () => ({
          write: async (b) => { chunks.push(b); },
          close: async () => {
            const blob = new Blob(chunks);
            window.__pngSize = blob.size;
            window.__pngB64 = await new Promise((res) => {
              const fr = new FileReader();
              fr.onload = () => res(fr.result.split(',')[1]);
              fr.readAsDataURL(blob);
            });
          },
        }),
      };
    };
  });
  await page.click('#exportbtn');
  await page.waitForFunction(() => window.__picked, { timeout: 5000 });
  console.log('picker called with:', JSON.stringify(await page.evaluate(() => ({ ...window.__picked, size: window.__pngSize }))));
  // save the stub-captured PNG for visual inspection
  const b64 = await page.evaluate(() => window.__pngB64);
  fs.writeFileSync('export-test.png', Buffer.from(b64, 'base64'));

  // 2) fallback path: no picker -> anchor download captured by CDP
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const cdp = await page.createCDPSession();
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: require('path').resolve(__dirname, 'dl') });
  await page.click('#exportbtn');
  await new Promise(r => setTimeout(r, 1500));
  const dl = fs.readdirSync('dl').filter(f => f.endsWith('.png'));
  console.log('fallback download:', dl, dl.length ? fs.statSync('dl/' + dl[0]).size + ' bytes' : '');
  console.log('status text:', await page.evaluate(() => document.getElementById('stat-left').textContent));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
