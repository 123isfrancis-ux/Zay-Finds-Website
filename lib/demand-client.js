const { dayKey } = require('./trending');
const { sampledSession, RETRY_MS, MAX_RETRY_MS } = require('./tracking-policy');
function createCollector({ storage, randomUUID, send, now = Date.now }) {
  let day, session, seen = new Set(), pending = [], sending = false, retryAt = 0, failures = 0;
  const storageKey = 'zay-demand-day';
  function read() { try { return JSON.parse(storage.getItem(storageKey) || 'null'); } catch { return null; } }
  function rotate() {
    const today = dayKey(now());
    if (today === day) return;
    day = today; seen = new Set(); pending = []; retryAt = 0; failures = 0;
    const value = read();
    session = value?.day === today && /^[a-f0-9-]{36}$/.test(value.session) ? value.session : randomUUID();
    if (value?.day === day && Array.isArray(value.seen)) seen = new Set(value.seen.slice(0,1500));
    try { storage.setItem(storageKey, JSON.stringify({day,session,seen:[...seen]})); } catch {}
  }
  return {
    add(id, type) {
      rotate();
      if (!['view','click','save'].includes(type) || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return;
      if (type === 'view' && !sampledSession(session)) return;
      const key = `${id}:${type}`;
      const saved = read();
      if (seen.has(key) || (saved?.day === day && saved.session === session && saved.seen?.includes(key)) || seen.size >= 1500) return;
      seen.add(key); pending.push({id,type});
    },
    async flush() {
      if (day !== dayKey(now())) { rotate(); return; }
      if (!pending.length || sending || now() < retryAt) return;
      const batch = pending.splice(0,25), sentDay = day, sentSession = session;
      sending = true;
      try {
        const result = await send({session:sentSession, events:batch});
        if (result === false || (result && result.ok === false)) throw Error('Unavailable');
        if (day === sentDay) {
          failures = 0; retryAt = 0;
          const value = read();
          const saved = value?.day === day && value.session === session && Array.isArray(value.seen) ? value.seen : [];
          const confirmed = [...new Set([...saved,...batch.map(e=>`${e.id}:${e.type}`)])].slice(0,1500);
          try { storage.setItem(storageKey,JSON.stringify({day,session,seen:confirmed})); } catch {}
        }
      } catch {
        if (day === sentDay) {
          pending.unshift(...batch);
          retryAt = now() + Math.min(MAX_RETRY_MS, RETRY_MS * 2 ** Math.min(failures++,3));
        }
      } finally { sending = false; }
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
    const adaptiveScores = {};
    for (const [id, score] of Object.entries(data.adaptive?.scores || {})) if (/^[a-zA-Z0-9_-]{1,64}$/.test(id) && Number.isFinite(score) && score >= 0 && score <= 1) adaptiveScores[id] = score;
    const low = Array.isArray(data.adaptive?.low) ? data.adaptive.low.filter(id=>Object.hasOwn(adaptiveScores,id)) : [];
    return {status:data.status,scores,adaptive:{scores:adaptiveScores,low},seed:/^\d{4}-\d{2}-\d{2}$/.test(data.seed) ? data.seed : dayKey(),collect:data.collect === true};
  } catch { return {status:'unavailable',scores:{},collect:false}; }
  finally { clearTimeout(timer); }
}
module.exports = { createCollector, loadTrending };
