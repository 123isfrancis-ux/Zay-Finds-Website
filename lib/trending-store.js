const { createHmac } = require('node:crypto');
const { WINDOW_DAYS, dayKey, makeSnapshot } = require('./trending');
const PREFIX = 'zay:trending:v1';
const RECORD_SCRIPT = `
local requests = redis.call('INCR', KEYS[3])
if requests == 1 then redis.call('EXPIRE', KEYS[3], 60) end
if requests > 60 then return -1 end
if redis.call('HLEN', KEYS[2]) > 1500 then return -1 end
local accepted = 0
for i = 1, #ARGV, 2 do
  local id = ARGV[i]
  local kind = ARGV[i + 1]
  if redis.call('HSETNX', KEYS[2], id .. ':view', 1) == 1 then
    redis.call('HINCRBY', KEYS[1], id .. ':view', 1)
    accepted = accepted + 1
  end
  if kind ~= 'view' and redis.call('HSETNX', KEYS[2], id .. ':' .. kind, 1) == 1 then
    redis.call('HINCRBY', KEYS[1], id .. ':' .. kind, 1)
    accepted = accepted + 1
  end
end
redis.call('EXPIRE', KEYS[1], 777600)
redis.call('EXPIRE', KEYS[2], 172800)
return accepted
`;
function createStore(env = process.env, fetcher = fetch, prefix = PREFIX) {
  if (!/^zay:trending:[a-zA-Z0-9:-]+$/.test(prefix)) throw Error('Invalid trending key prefix');
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token || env.TRENDING_ENABLED !== '1') return null;
  if (new URL(url).protocol !== 'https:') throw Error('Trending storage requires HTTPS');
  const digest = value => createHmac('sha256', token).update(value).digest('hex').slice(0,32);
  async function request(body, suffix = '') {
    const response = await fetcher(url.replace(/\/$/, '') + suffix, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(4000), cache: 'no-store',
    });
    if (!response.ok) throw Error('Trending storage unavailable');
    const data = await response.json();
    if (data.error || (Array.isArray(data) && data.some(row => row.error))) throw Error('Trending storage request failed');
    return data;
  }
  return {
    async record(session, address, events, now = Date.now()) {
      const day = dayKey(now);
      const keys = [`${prefix}:day:${day}`, `${prefix}:seen:${day}:${digest(session)}`, `${prefix}:rate:${digest(day + ':' + address)}`];
      const result = await request(['EVAL', RECORD_SCRIPT, keys.length, ...keys, ...events.flatMap(e => [e.id, e.type])]);
      if (result.result === -1) return false;
      if (!Number.isInteger(result.result) || result.result < 0) throw Error('Unexpected trending write result');
      return true;
    },
    async dashboardBlocked(address) {const result=await request(['GET',`${prefix}:admin-rate:${digest(address)}`]);return Number(result.result)>20;},
    async allowDashboard(address) {
      const result=await request(['EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n",1,`${prefix}:admin-rate:${digest(address)}`]);
      return Number(result.result)<=20;
    },
    async signals(session,address,events,now=Date.now()) {
      const day=dayKey(now);
      const script="local n=redis.call('INCR',KEYS[3]); if n==1 then redis.call('EXPIRE',KEYS[3],60) end; if n>30 or redis.call('HLEN',KEYS[2])>200 then return 0 end; for i,key in ipairs(ARGV) do if redis.call('HSETNX',KEYS[2],key,1)==1 then redis.call('HINCRBY',KEYS[1],key,1) end end; redis.call('EXPIRE',KEYS[1],777600); redis.call('EXPIRE',KEYS[2],172800); return 1";
      const result=await request(['EVAL',script,3,`${prefix}:signals:${day}`,`${prefix}:signal-seen:${day}:${digest(session)}`,`${prefix}:signal-rate:${digest(address)}`,...events]);return result.result===1;
    },
    async dashboard(now=Date.now()) {
      const commands=['day','signals'].flatMap(kind=>Array.from({length:WINDOW_DAYS},(_,age)=>['HGETALL',`${prefix}:${kind}:${dayKey(now-age*86400000)}`]));
      const results=await request(commands,'/pipeline');
      if(!Array.isArray(results)||results.length!==WINDOW_DAYS*2)throw Error('Invalid dashboard response');
      const buckets=results.map(({result})=>{if(!Array.isArray(result)||result.length%2)throw Error('Invalid counters');const row={};for(let i=0;i<result.length;i+=2)row[result[i]]=result[i+1];return row;});
      return {days:buckets.slice(0,WINDOW_DAYS),signals:buckets.slice(WINDOW_DAYS)};
    },
    async snapshot(validIds, now = Date.now()) {
      const commands = Array.from({length:WINDOW_DAYS}, (_, age) => ['HGETALL', `${prefix}:day:${dayKey(now - age * 86400000)}`]);
      const results = await request(commands, '/pipeline');
      if (!Array.isArray(results) || results.length !== WINDOW_DAYS) throw Error('Unexpected trending read result');
      const days = results.map(({result}) => {
        if (!Array.isArray(result) || result.length % 2) throw Error('Unexpected trending counters');
        const fields = {};
        for(let i=0;i<result.length;i+=2) fields[result[i]]=result[i+1];
        return fields;
      });
      return makeSnapshot(days, validIds, now);
    },
  };
}
module.exports = { createStore, RECORD_SCRIPT };
