const fs = require('node:fs');
const path = require('node:path');
const { weidianId, extractImage } = require('../lib/weidian-images');
const root = path.join(__dirname, '..');
const catalogue = require('../data/catalogue.json');
const file = path.join(root, 'data/weidian-images.json');
const reportFile = path.join(root, 'data/weidian-image-report.json');
const stateFile = path.join(root, '.image-sync-state.json');
const lockFile = path.join(root, '.image-sync.lock');
const read = (p, fallback) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : fallback;
const save = (p, value) => { fs.writeFileSync(p + '.tmp', JSON.stringify(value, null, 2)); fs.renameSync(p + '.tmp', p); };
const now = Date.now();
const state = read(stateFile, { attempts: {}, nextRunAt: 0, backoffHours: 0, paused: false });
if (state.paused || state.nextRunAt > now) {
  console.log(JSON.stringify({ skipped: true, paused: state.paused, nextRunAt: state.nextRunAt, reason: state.reason }));
  process.exit(0);
}
if (fs.existsSync(lockFile)) {
  if (now - fs.statSync(lockFile).mtimeMs < 20 * 60 * 1000) { console.log('Another image batch is active.'); process.exit(0); }
  fs.unlinkSync(lockFile);
}
try { fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' }); }
catch { console.log('Another image batch is active.'); process.exit(0); }
const images = read(file, {});
const ids = [...new Set(catalogue.items.map(item => weidianId(item.link)).filter(Boolean))];
// Process continuously within a four-minute run; never overlap scheduled runs.
const deadline = now + 4 * 60000;
const pending = ids.filter(id => !images[id]?.image && (state.attempts[id]?.count || 0) < 3)
  .sort((a,b) => (state.attempts[a]?.lastAt || 0) - (state.attempts[b]?.lastAt || 0));
let completed = 0, stopped = false;
const failures = [];
const startedAt = new Date().toISOString();
function checkpoint() {
  save(file, images);
  save(stateFile, state);
  save(reportFile, { startedAt, checkedAt: new Date().toISOString(), uniqueListings: ids.length, completed,
    withImages: ids.filter(id => images[id]?.image).length, stopped, failures,
    remaining: ids.filter(id => !images[id]?.image).length,
    exhausted: ids.filter(id => !images[id]?.image && (state.attempts[id]?.count || 0) >= 3).length,
    unsupportedRows: catalogue.items.filter(item => !weidianId(item.link) && !item.image).length });
}
(async () => {
  try {
    for (const id of pending) {
      if (Date.now() >= deadline) break;
      if (completed) await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const response = await fetch(`https://weidian.com/item.html?itemID=${id}`, { signal: AbortSignal.timeout(20000) });
        if ([401, 403].includes(response.status)) {
          state.paused = true; throw new Error(`Access denied (${response.status}); manual review required`);
        }
        if (response.status === 429) {
          const retry = response.headers.get('retry-after');
          const delay = /^\d+$/.test(retry || '') ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now()) || 0;
          state.nextRunAt = Date.now() + Math.max(300000, delay);
          throw new Error('Rate limited (429)');
        }
        if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(`HTTP ${response.status}`);
        const html = response.ok ? await response.text() : '';
        if (/verify you are human|access denied|<title>[^<]*captcha/i.test(html)) {
          state.paused = true; throw new Error('Access challenge; manual review required');
        }
        const image = extractImage(html, id);
        if (image) images[id] = { image, source: response.url, checkedAt: new Date().toISOString() };
        else {
          state.attempts[id] = { count: (state.attempts[id]?.count || 0) + 1, lastAt: Date.now() };
          failures.push({ id, reason: 'No matching public product-image metadata' });
        }
        state.backoffHours = 0;
      } catch (error) {
        const reason = error.cause?.code || error.message;
        failures.push({ id, reason });
        state.backoffHours = 0;
        state.nextRunAt = Math.max(state.nextRunAt || 0, Date.now() + 5 * 60000);
        state.reason = reason;
        stopped = true;
      }
      completed++;
      checkpoint();
      if (stopped) break;
    }
    if (!stopped) { state.nextRunAt = Date.now() + 5 * 60000; state.reason = ''; }
    checkpoint();
    console.log(JSON.stringify({ completed, addedOrCached: Object.keys(images).length, stopped, paused: state.paused,
      nextRunAt: state.nextRunAt, remaining: ids.filter(id => !images[id]?.image).length, pendingEligible: pending.length }));
  } finally { fs.unlinkSync(lockFile); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
