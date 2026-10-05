const { dayKey } = require('./trending');
function createCollector({ storage, randomUUID, send, now = Date.now }) {
  let day, session, seen = new Set(), pending = [];
  function rotate() {
    const today = dayKey(now());
    if (today === day) return;
    day = today; seen = new Set(); pending = [];
    try {
      const value = JSON.parse(storage.getItem('zay-demand-day') || 'null');
      session = value?.day === today && /^[a-f0-9-]{36}$/.test(value.session) ? value.session : randomUUID();
      storage.setItem('zay-demand-day', JSON.stringify({day, session}));
    } catch { session = randomUUID(); }
  }
  return {
    add(id, type) {
      rotate();
      if (!['view','click','save'].includes(type) || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return;
      const key = `${id}:${type}`;
      if (seen.has(key) || seen.size >= 1500) return;
      seen.add(key); pending.push({id,type});
    },
    flush() {
      if (!pending.length) return;
      if (day !== dayKey(now())) { rotate(); return; }
      const batch = pending.splice(0,25);
      send({session, events:batch});
    },
  };
}
async function loadTrending(fetcher = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetcher('/api/trending', {signal:controller.signal});
    if (!response.ok) throw Error('Unavailable');
    const data = await response.json();
    if (data.version !== 1 || !['ready','learning','disabled','unavailable'].includes(data.status)) throw Error('Invalid snapshot');
    const scores = {};
    for (const [id, score] of Object.entries(data.scores || {})) if (/^[a-zA-Z0-9_-]{1,64}$/.test(id) && Number.isFinite(score) && score >= 0 && score <= 1) scores[id] = score;
    return {status:data.status,scores,seed:/^\d{4}-\d{2}-\d{2}$/.test(data.seed) ? data.seed : dayKey(),collect:data.collect === true};
  } catch { return {status:'unavailable',scores:{},collect:false}; }
  finally { clearTimeout(timer); }
}
module.exports = { createCollector, loadTrending };
