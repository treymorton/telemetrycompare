const fs = require('fs');
const c = require('./core.js');

function load(p) {
  const buf = fs.readFileSync(p);
  const text = c.decodeBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return c.buildTable(c.splitCsv(text));
}

// --- nvperf ---
const nv = load((process.env.TEST_B || require('path').resolve(__dirname, 'testData/PW714260-82DRYL4-nvperf_log_20261021_074559.csv')));
console.log('nvperf rows:', nv.n, 'cols:', nv.headers.length);
console.log('nvperf isTime:', Object.entries(nv.isTime).filter(([,v])=>v).map(([k])=>k));
console.log('nvperf non-numeric cols:', Object.keys(nv.text));
const gu = nv.num['gpu_util_pct'];
console.log('nvperf gpu_util: n=' + gu.length, 'min=' + Math.min(...gu), 'max=' + Math.max(...gu), 'NaNs=' + [...gu].filter(Number.isNaN).length);
const ts = nv.num['timestamp'];
console.log('nvperf elapsed span (s):', ts[nv.n-1]-ts[0]);

// --- hwinfo ---
const hw = load((process.env.TEST_A || require('path').resolve(__dirname, 'testData/PW714260-82DRYL4-hwinfo.CSV')));
console.log('\nhwinfo rows:', hw.n, 'cols:', hw.headers.length);
console.log('hwinfo isTime:', Object.entries(hw.isTime).filter(([,v])=>v).map(([k])=>k));
const dtc = hw.num['Date Time'];
console.log('Date Time first/last:', new Date(dtc[0]*1000).toISOString(), '->', new Date(dtc[hw.n-1]*1000).toISOString());
const d = [];
for (let i=1;i<hw.n;i++) d.push(dtc[i]-dtc[i-1]);
d.sort((a,b)=>a-b);
console.log('median sample interval (s):', d[d.length>>1], '| negative gaps:', d.filter(x=>x<0).length);
// footer junk check: no rows with "System:" leaked into data
const junkCol = hw.headers.find(h => h.includes('System'));
console.log('footer leak check (header contains System):', junkCol || 'clean');
const core = hw.num['Core Usage (avg) [%]'];
console.log('Core Usage (avg): min=' + Math.min(...core), 'max=' + Math.max(...core), 'NaNs=' + [...core].filter(Number.isNaN).length);
console.log('sample of numeric cols:', Object.keys(hw.num).slice(0,6));
// downsample sanity
const ds = c.downsample(dtc, core, 100);
console.log('downsample 246->' + ds.x.length, 'in-range:', ds.y.every(v => Number.isNaN(v) || (v>=0 && v<=100)));

// --- describeColumn look-up ---
function expectDesc(name, substr) {
  const d = c.describeColumn(name);
  if (!d || !d.toLowerCase().includes(substr.toLowerCase())) {
    console.error('FAIL describeColumn(' + JSON.stringify(name) + ') = ' + JSON.stringify(d) + ', expected to contain: ' + substr);
    process.exitCode = 1;
  }
}
expectDesc('gpu_util_pct', 'busy');
expectDesc('cpu_queue_length', 'bottleneck');
expectDesc('timestamp', 'date and time');
expectDesc('Date', 'calendar');
expectDesc('Total CPU Usage [%]', 'across all cores');
expectDesc('P-core 3 Usage [%]', 'this cpu core');
expectDesc('P-core 3 Distance to TjMAX [\u00B0C]', 'throttl');
expectDesc('GPU Temperature [\u00B0C]', 'gpu temperature');
expectDesc('GPU Hot Spot Temperature [\u00B0C]', 'hottest');
expectDesc('GPU Memory Usage [%]', 'vram');
expectDesc('Physical Memory Load [%]', 'ram');
expectDesc('Read Rate [MB/s]', 'disk read');
expectDesc('Core Clocks (avg) [MHz]', 'clock speed');
expectDesc('Core Effective Clocks (avg) [MHz]', 'actual performance');
expectDesc('Package C State Residency [%]', 'sleep state');
expectDesc('Framerate Displayed (avg) [FPS]', 'monitor');
if (c.describeColumn('Totally Made Up Widget') !== '') { console.error('FAIL: unknown column should describe as empty'); process.exitCode = 1; }
// coverage over the real 493-column HWiNFO header set
const described = hw.headers.filter(h => c.describeColumn(h));
const cov = described.length / hw.headers.length;
console.log('describeColumn coverage of ' + hw.headers.length + ' real HWiNFO headers: ' + described.length + ' (' + Math.round(cov * 100) + '%)');
if (cov < 0.9) { console.error('FAIL: <90% header coverage'); process.exitCode = 1; }
const nvc = Object.keys(nv.num).filter(h => c.describeColumn(h)).length;
console.log('describeColumn coverage of nvperf numeric columns: ' + nvc + '/' + Object.keys(nv.num).length);
if (nvc < Object.keys(nv.num).length) { console.error('FAIL: nvperf columns missing descriptions'); process.exitCode = 1; }
console.log('describeColumn: ' + (process.exitCode ? 'FAILURES ABOVE' : 'all assertions OK'));
