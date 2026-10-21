const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + require('path').resolve(__dirname, 'index.html'));
  const input = await page.$('#fileA');
  await input.uploadFile((process.env.TEST_A || require('path').resolve(__dirname, 'testData/PW714260-82DRYL4-hwinfo.CSV')));
  await page.waitForFunction(() => document.getElementById('metaA').textContent.includes('rows'));
  await page.evaluate(() => {
    const r = [...document.querySelectorAll('#collist .colrow')].find(r => r.querySelector('.cname').textContent === 'Core Clocks (avg) [MHz]');
    r.querySelector('.cbA input').click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'e2e-y0.png' });
  console.log('status:', await page.evaluate(() => document.getElementById('stat-left').textContent));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
