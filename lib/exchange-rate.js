const fallback = require('../data/exchange-rate.json');
let cached = fallback;
let nextRefresh = 0;
let pending;
function parseRate(data) {
  const observation = data?.observations?.at(-1);
  const usdToCad = Number(observation?.FXUSDCAD?.v);
  if (!Number.isFinite(usdToCad) || usdToCad <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(observation?.d || '')) throw new Error('Invalid exchange rate');
  return { usdToCad, date: observation.d, source: fallback.source };
}
async function getRate() {
  if (Date.now() < nextRefresh) return cached;
  if (!pending) pending = (async () => {
    try {
      const response = await fetch(fallback.source, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error('Rate unavailable');
      cached = parseRate(await response.json());
      nextRefresh = Date.now() + 6 * 60 * 60 * 1000;
    } catch { nextRefresh = Date.now() + 5 * 60 * 1000; }
    finally { pending = null; }
    return cached;
  })();
  return pending;
}
module.exports = { getRate, parseRate };
