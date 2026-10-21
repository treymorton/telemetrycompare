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
