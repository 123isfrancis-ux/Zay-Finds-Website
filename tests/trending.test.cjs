const test = require('node:test');
const assert = require('node:assert/strict');
const {aggregateDays, scoreProduct, makeSnapshot, rankTrending} = require('../lib/trending');
const {createCollector, loadTrending} = require('../lib/demand-client');
const {createTrendingHandler} = require('../lib/trending-api');
const {createStore, RECORD_SCRIPT} = require('../lib/trending-store');
const stamp = Date.parse('2026-10-05T12:00:00Z');
const session = '12345678-1234-4123-8123-123456789ab1';
const item = id => ({id,image:'image',categoryOrder:{test:1}});
const headers = {host:'shop.test',origin:'https://shop.test','content-type':'application/json','user-agent':'Mozilla'};
async function call(handler, options = {}) {
  const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(body){this.body=body;return this;},end(){return this;}};
  await handler({method:'GET',headers,...options},res); return res;
}
test('rates beat raw clicks; tiny samples do not trend and saves carry more weight',()=>{
  const totals=aggregateDays([{'a:view':1000,'a:click':60,'a:save':2,'b:view':100,'b:click':20,'b:save':10,'c:view':1,'c:click':1,'c:save':1}]);
  assert.ok(scoreProduct(totals.b)>scoreProduct(totals.a));
  assert.equal(scoreProduct(totals.c),null);
  assert.ok(scoreProduct({...totals.b,click:10,save:20})>scoreProduct(totals.b));
});
test('recent activity weighs more and invalid, old or hidden metrics cannot rank',()=>{
  const fields={'a:view':100,'a:click':30,'a:save':10};
  assert.ok(scoreProduct(aggregateDays([fields]).a)>scoreProduct(aggregateDays([{}, {}, {}, {}, {}, {},fields]).a));
  assert.deepEqual(aggregateDays([{}, {}, {}, {}, {}, {}, {},fields]),{});
  const result=makeSnapshot([{'a:view':100,'a:click':30,'hidden:view':100,'hidden:click':50,'a:save':'bad'}],new Set(['a']),stamp);
  assert.equal(result.status,'learning'); assert.deepEqual(Object.keys(result.scores),['a']);
});
test('stable ranking reserves discovery slots, preserves every item and never mutates source',()=>{
  const input='abcdefghij'.split('').map(item),original=JSON.stringify(input);
  const snapshot={status:'ready',scores:{a:.2,b:.3,c:.4,d:.5,e:.6,f:.7},seed:'2026-10-05'};
  const ranked=rankTrending(input,snapshot);
  assert.deepEqual(ranked.slice(0,4).map(x=>x.id),['f','e','d','c']);
  assert.ok('ghij'.includes(ranked[4].id));
  assert.equal(new Set(ranked.map(x=>x.id)).size,input.length);
  assert.equal(JSON.stringify(input),original);
  assert.deepEqual(rankTrending(input,snapshot),ranked);
  assert.deepEqual(rankTrending(input,{status:'learning'}),input);
  assert.deepEqual(rankTrending([item('unmeasured')],snapshot),[item('unmeasured')]);
});
test('daily browser deduplication survives another tab and rotates anonymous IDs',async()=>{
  const memory=new Map(),sent=[];let now=stamp, generated=0;
  const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
  const options={storage,randomUUID:()=>{generated++;return session;},send:b=>sent.push(b),now:()=>now};
  const first=createCollector(options);first.add('a','view');first.add('a','view');first.add('a','save');first.add('a','save');await first.flush();
  assert.equal(sent[0].events.length,2);
  const second=createCollector(options);second.add('a','click');await second.flush();assert.equal(generated,1);
  assert.equal(sent[0].session,sent[1].session);
  now+=86400000;second.add('a','view');await second.flush();assert.equal(generated,2);
});
test('collector bounds batches, drops old-day queues and survives blocked local storage',async()=>{
  const sent=[];let now=stamp;
  const c=createCollector({storage:{getItem(){throw Error('blocked');}},randomUUID:()=>session,send:b=>sent.push(b),now:()=>now});
  for(let i=0;i<70;i++)c.add('p'+i,'view');await c.flush();assert.equal(sent[0].events.length,25);
  now+=86400000;await c.flush();assert.equal(sent.length,1);c.add('new','click');await c.flush();assert.equal(sent[1].events.length,1);
});
test('API rejects bad origin, unknown products, oversized events and wrong methods before storage',async()=>{
  let writes=0;
  const handler=createTrendingHandler({validIds:new Set(['a']),getStore:()=>({record:async()=>{writes++;return true;}})});
  const body={session,events:[{id:'a',type:'view'}]};
  assert.equal((await call(handler,{method:'DELETE'})).code,405);
  assert.equal((await call(handler,{method:'POST',headers:{...headers,origin:'https://evil.test'},body})).code,403);
  for(const events of [[{id:'hidden',type:'view'}],[{id:'a',type:'purchase'}],Array(26).fill({id:'a',type:'view'}),[]])assert.equal((await call(handler,{method:'POST',body:{session,events}})).code,400);
  assert.equal(writes,0);
  assert.equal((await call(handler,{method:'POST',body})).code,204);assert.equal(writes,1);
  assert.equal((await call(handler,{method:'POST',headers:{...headers,dnt:'1'},body})).code,204);assert.equal(writes,1);
});
test('API handles storage failure, disabled tracking, rate limits and cached snapshots',async()=>{
  const body={session,events:[{id:'a',type:'click'}]};const base={validIds:new Set(['a']),now:()=>stamp};
  assert.equal((await call(createTrendingHandler({...base,getStore:()=>null}))).body.collect,false);
  const failed=createTrendingHandler({...base,getStore:()=>{throw Error('secret');}});
  const unavailable=await call(failed);assert.equal(unavailable.body.status,'unavailable');assert.ok(!JSON.stringify(unavailable).includes('secret'));
  assert.equal((await call(failed,{method:'POST',body})).code,503);
  const limited=createTrendingHandler({...base,getStore:()=>({record:async()=>false})});
  const limit=await call(limited,{method:'POST',body});assert.equal(limit.code,429);assert.equal(limit.headers['Retry-After'],'60');
  let reads=0;
  const handler=createTrendingHandler({...base,getStore:()=>({snapshot:async()=>{reads++;return {status:'learning',scores:{}};}})});
  await Promise.all([call(handler),call(handler)]);await call(handler);assert.equal(reads,1);
});
test('REST adapter hashes identifiers, uses atomic writes and fails on rejected commands',async()=>{
  const requests=[];const env={TRENDING_ENABLED:'1',UPSTASH_REDIS_REST_URL:'https://redis.test',UPSTASH_REDIS_REST_TOKEN:'private-token'};
  const fetcher=async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>url.endsWith('/pipeline')?Array.from({length:7},()=>({result:[]})):{result:1}};};
  const store=createStore(env,fetcher);await store.record(session,'192.0.2.1',[{id:'a',type:'click'}],stamp);
  assert.equal(requests[0].body[0],'EVAL');assert.equal(requests[0].body[1],RECORD_SCRIPT);
  assert.ok(!JSON.stringify(requests).includes(session));assert.ok(!JSON.stringify(requests).includes('192.0.2.1'));
  assert.equal((await store.snapshot(new Set(['a']),stamp)).status,'learning');
  assert.equal(createStore({...env,TRENDING_ENABLED:'0'},fetcher),null);
  const bad=createStore(env,async()=>({ok:true,json:async()=>({error:'bad'})}));await assert.rejects(()=>bad.record(session,'ip',[],stamp));
});
test('client snapshot fetch falls back cleanly and rejects unsafe scores',async()=>{
  assert.equal((await loadTrending(async()=>{throw Error('offline');})).status,'unavailable');
  const data=await loadTrending(async()=>({ok:true,json:async()=>({version:1,status:'ready',scores:{good:.4,bad:'10',overflow:100},seed:'invalid',collect:true})}));
  assert.deepEqual(data.scores,{good:.4});assert.equal(data.collect,true);
});

test('adaptive ranking compares like products and waits for 100 views plus a valid cohort',()=>{
 const {adaptiveScores}=require('../lib/trending');
 const items=['a','b','c','tiny'].map(id=>({id,name:'Watch',image:'photo'}));
 const fields={'a:view':1000,'a:click':20,'b:view':100,'b:click':20,'c:view':100,'c:click':0,'tiny:view':99,'tiny:click':40};
 const scores=adaptiveScores([fields],items);
 assert.ok(scores.scores.b>scores.scores.a);assert.ok(scores.low.includes('c'));assert.equal(scores.scores.tiny,undefined);
 assert.deepEqual(adaptiveScores([fields],items.slice(0,2)),{scores:{},low:[]});
 const shoes=['x','y','z'].map(id=>({id,name:'Sneaker',image:'photo'}));
 const shoeFields=Object.fromEntries(shoes.flatMap(i=>[[i.id+':view',100],[i.id+':click',50]]));
 assert.deepEqual(adaptiveScores([{...fields,...shoeFields}],[...items,...shoes]).scores.b,scores.scores.b);
 assert.equal(adaptiveScores([fields],items.map(i=>({...i,visibility:'hidden'}))).scores.a,undefined);
});
test('adaptive ordering demotes weak products, rotates discovery and preserves all items without mutation',()=>{
 const {rankRecommended}=require('../lib/trending');
 const items=['weak','a','b','c','d','e','new1','new2','noPhoto'].map(id=>({id,image:id==='noPhoto'?'':'photo'}));
 const snapshot={status:'learning',seed:'2026-10-06',adaptive:{scores:{weak:.1,a:.9,b:.8,c:.7,d:.6,e:.5},low:['weak']}};
 const ranked=rankRecommended(items,snapshot);
 assert.deepEqual(ranked.slice(0,4).map(i=>i.id),['a','b','c','d']);
 assert.ok(ranked[4].id.startsWith('new'));assert.equal(ranked.at(-2).id,'weak');assert.equal(ranked.at(-1).id,'noPhoto');
 assert.deepEqual(new Set(ranked.map(i=>i.id)),new Set(items.map(i=>i.id)));
 assert.equal(items[0].id,'weak');assert.deepEqual(rankRecommended(items,snapshot),ranked);
 assert.deepEqual(rankRecommended(items,{...snapshot,status:'unavailable'}),items);
 assert.deepEqual(rankRecommended([items[6]],snapshot),[items[6]]);
});
test('adaptive evidence follows recent demand and rejects unsafe client scores',async()=>{
 const {adaptiveScores}=require('../lib/trending');
 const items=['a','b','c'].map(id=>({id,name:'T-Shirt',image:'p'}));
 const recent={'a:view':100,'a:click':20,'b:view':100,'b:click':1,'c:view':100,'c:click':5};
 const old={'a:view':100,'a:click':1,'b:view':100,'b:click':20,'c:view':100,'c:click':5};
 const scores=adaptiveScores([recent,{},{},{},{},{},old],items).scores;
 assert.ok(scores.a>scores.b);
 const data=await loadTrending(async()=>({ok:true,json:async()=>({version:1,status:'learning',adaptive:{scores:{good:.8,bad:-1,huge:9},low:['good','bad']}})}));
 assert.deepEqual(data.adaptive,{scores:{good:.8},low:['good']});
});

test('unsampled browsers keep clicks and saves but send no passive views',async()=>{
 const sent=[],unsampled='12345678-1234-4123-8123-123456789ab0';
 const c=createCollector({storage:{getItem:()=>null,setItem:()=>{}},randomUUID:()=>unsampled,send:b=>sent.push(b),now:()=>stamp});
 c.add('a','view');c.add('a','click');c.add('a','save');await c.flush();
 assert.deepEqual(sent[0].events,[{id:'a',type:'click'},{id:'a',type:'save'}]);
 let requests=0;
 const store=createStore({TRENDING_ENABLED:'1',KV_REST_API_URL:'https://sample.test',KV_REST_API_TOKEN:'test'},async()=>{requests++;return {ok:true,json:async()=>({result:1})};});
 assert.equal(await store.record(unsampled,'ip',[{id:'a',type:'view'}]),true);assert.equal(requests,0);
 await store.record(unsampled,'ip',[{id:'a',type:'click'}]);assert.equal(requests,1);
});
test('failed batches back off, retry exactly once at the next window, and persist only confirmed events',async()=>{
 const memory=new Map(),sent=[];let time=stamp,fail=true;
 const opts={storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},randomUUID:()=>session,now:()=>time,send:async b=>{sent.push(b);return {ok:!fail};}};
 const c=createCollector(opts);c.add('a','click');await c.flush();await c.flush();assert.equal(sent.length,1);
 assert.deepEqual(JSON.parse(memory.get('zay-demand-day')).seen,[]);
 time+=60000;fail=false;await c.flush();assert.equal(sent.length,2);assert.deepEqual(sent[0],sent[1]);
 const reloaded=createCollector(opts);reloaded.add('a','click');await reloaded.flush();assert.equal(sent.length,2);
});
test('failed snapshot reads cool down and recover after five minutes',async()=>{
 let time=stamp,reads=0,fail=true;
 const handler=createTrendingHandler({validIds:new Set(['a']),now:()=>time,getStore:()=>({snapshot:async()=>{reads++;if(fail)throw Error('offline');return {version:1,status:'learning',scores:{}};}})});
 await call(handler);await call(handler);time+=299000;await call(handler);assert.equal(reads,1);
 time+=1000;fail=false;assert.equal((await call(handler)).body.collect,true);assert.equal(reads,2);
});
test('store circuit breaker covers new store instances and separate read/write methods',async()=>{
 let requests=0;const env={TRENDING_ENABLED:'1',KV_REST_API_URL:'https://breaker.test',KV_REST_API_TOKEN:'test'};
 const fetcher=async()=>{requests++;throw Error('offline');};
 await assert.rejects(()=>createStore(env,fetcher).record(session,'ip',[{id:'a',type:'click'}]));
 await assert.rejects(()=>createStore(env,fetcher).dashboard());
 await assert.rejects(()=>createStore(env,fetcher).signals(session,'ip',['image:a']));
 assert.equal(requests,1);
});
test('ranking uses only matching sampled exposures and actions, never legacy or full-population clicks',async()=>{
 const fields=['a:view',10000,'a:click',9000,'a:sample_view',100,'a:sample_click',10,'a:sample_save',2];
 const store=createStore({TRENDING_ENABLED:'1',KV_REST_API_URL:'https://rates.test',KV_REST_API_TOKEN:'test'},async()=>({ok:true,json:async()=>Array.from({length:7},(_,i)=>({result:i===0?fields:[]}))}));
 const result=await store.snapshot(new Set(['a']),stamp);
 assert.equal(result.scores.a,makeSnapshot([{'a:view':100,'a:click':10,'a:save':2}],new Set(['a']),stamp).scores.a);
});
