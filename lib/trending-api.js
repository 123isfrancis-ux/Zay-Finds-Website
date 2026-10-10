const { dayKey } = require('./trending');
const { createStore } = require('./trending-store');
function validBatch(body, validIds) {
  return body && typeof body.session === 'string' && /^[a-f0-9-]{36}$/.test(body.session)
    && Array.isArray(body.events) && body.events.length > 0 && body.events.length <= 25
    && body.events.every(e => e && validIds.has(e.id) && ['view','click','save'].includes(e.type));
}
function sameOrigin(req) {
  try { return new URL(req.headers.origin).host === req.headers.host && !['cross-site','none'].includes(req.headers['sec-fetch-site']); } catch { return false; }
}
function createTrendingHandler({ validIds, items = [], getStore = createStore, now = Date.now }) {
  let cached = null, cacheUntil = 0, pending = null, retryAt = 0;
  return async function trending(req, res) {
    if (!['GET','POST'].includes(req.method)) {
      res.setHeader('Allow','GET, POST');
      return res.status(405).json({error:'Method not allowed'});
    }
    res.setHeader('Cache-Control','no-store');
    if (req.method === 'POST') {
      if (!sameOrigin(req)) return res.status(403).json({error:'Invalid origin'});
      if (!String(req.headers['content-type'] || '').startsWith('application/json') || !validBatch(req.body, validIds)) return res.status(400).json({error:'Invalid events'});
      if (req.headers.dnt === '1' || req.headers['sec-gpc'] === '1' || /bot|crawler|spider|headless/i.test(req.headers['user-agent'] || '')) return res.status(204).end();
    }
    try {
      if (now() < retryAt) throw Error('Cooling down');
      const store = getStore();
      if (!store) return req.method === 'POST' ? res.status(204).end() : res.status(200).json({version:1,status:'disabled',scores:{},seed:dayKey(now()),collect:false});
      if (req.method === 'POST') {
        // Vercel provides the trusted original client address in x-vercel-forwarded-for.
        const address = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
        const accepted = await store.record(req.body.session, address, req.body.events, now());
        if (!accepted) { res.setHeader('Retry-After','60'); return res.status(429).json({error:'Please try later'}); }
        return res.status(204).end();
      }
      const time = now();
      if (!cached || cacheUntil <= time) {
        pending ||= store.snapshot(validIds, time, items);
        try { cached = await pending; cacheUntil = time + 300000; } finally { pending = null; }
      }
      res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
      return res.status(200).json({...cached, collect:true});
    } catch {
      if (now() >= retryAt) retryAt = now() + 300000;
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((retryAt-now())/1000))));
      if (req.method === 'GET') res.setHeader('Cache-Control','public, max-age=30, s-maxage=60');
      // Never stop browsing or expose storage errors/secrets to visitors.
      return req.method === 'POST' ? res.status(503).json({error:'Temporarily unavailable'}) : res.status(200).json({version:1,status:'unavailable',scores:{},seed:dayKey(now()),collect:false});
    }
  };
}
module.exports = { createTrendingHandler, validBatch, sameOrigin };
