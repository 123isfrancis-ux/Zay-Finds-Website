const fs = require('node:fs');
const path = require('node:path');
const { weidianId, extractImage } = require('../lib/weidian-images');
const root = path.join(__dirname, '..');
const catalogue = require('../data/catalogue.json');
const file = path.join(root, 'data/weidian-images.json');
const reportFile = path.join(root, 'data/weidian-image-report.json');
const images = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
const ids = [...new Set(catalogue.items.map(item => weidianId(item.link)).filter(Boolean))];
const limit = Number(process.env.IMAGE_LIMIT) || Infinity;
const pending = ids.filter(id => !images[id]?.image).slice(0, limit);
const concurrency = Math.max(1, Math.min(4, Number(process.env.IMAGE_CONCURRENCY) || 1));
let cursor = 0, completed = 0, stopped = false, connectionFailures = 0;
const failures = [];
const startedAt = new Date().toISOString();
function checkpoint() {
  fs.writeFileSync(file + '.tmp', JSON.stringify(images));
  fs.renameSync(file + '.tmp', file);
  fs.writeFileSync(reportFile, JSON.stringify({ startedAt, checkedAt: new Date().toISOString(), uniqueListings: ids.length,
    completed, withImages: Object.keys(images).length, stopped, failures,
    unsupportedRows: catalogue.items.filter(item => !weidianId(item.link)).length }, null, 2));
}
async function worker() {
  while (!stopped && cursor < pending.length) {
    const id = pending[cursor++];
    try {
      const url = `https://weidian.com/item.html?itemID=${id}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if ([401, 403, 429].includes(response.status)) { stopped = true; throw new Error(`Access/rate limit ${response.status}; stopped`); }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      connectionFailures = 0;
      if (/verify you are human|access denied|<title>[^<]*captcha/i.test(html)) { stopped = true; throw new Error('Access challenge; stopped'); }
      const image = extractImage(html, id);
      if (image) images[id] = { image, source: response.url, checkedAt: new Date().toISOString() };
      else failures.push({ id, reason: 'No matching public product-image metadata' });
    } catch (error) {
      failures.push({ id, reason: error.cause?.code || error.message });
      if (++connectionFailures >= 3) stopped = true;
      if (!stopped) await new Promise(resolve => setTimeout(resolve, 5000));
    }
    completed++;
    if (completed % 50 === 0) { checkpoint(); console.log(`${completed}/${pending.length} checked; ${Object.keys(images).length} image links; ${failures.length} unavailable`); }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
(async () => { await Promise.all(Array.from({ length: concurrency }, worker)); checkpoint(); console.log(JSON.stringify({ completed, withImages: Object.keys(images).length, failures: failures.length, stopped })); if (stopped) process.exitCode = 1; })();
