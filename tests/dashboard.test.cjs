const test=require('node:test'),assert=require('node:assert/strict');
const {authorized,report,safeSearch}=require('../lib/dashboard');
test('dashboard fails closed without a strong configured password and exact authorization',()=>{
 const password='private-test-password-of-32-characters';assert.equal(authorized('Bearer '+password,password),true);
 for(const pair of [[undefined,password],['Bearer wrong',password],['Bearer test','test'],['Bearer secret',undefined]])assert.equal(authorized(...pair),false);
});
test('reports aggregate real buckets, omit hidden listings and require enough views for low engagement',()=>{
 const items=[{id:'a',name:'A',image:'photo'},{id:'b',name:'B',image:''},{id:'hidden',visibility:'hidden'}];
 const data=report(items,[{'a:sample_view':40,'a:sample_click':1,'a:click':1,'b:sample_view':2,'b:save':1,'hidden:view':100}], [{'image:a':2,'search:nike shoes':3}],0);
 assert.deepEqual(data.totals,{views:42,clicks:1,saves:1});assert.equal(data.lowEngagement[0].id,'a');assert.equal(data.photoIssues.length,2);assert.deepEqual(data.searches,[{term:'nike shoes',count:3}]);assert.equal(report(items,[],[]).mostClicked.length,0);
});
test('search reporting does not retain arbitrary text or contact details',()=>{
 const vocabulary=new Set(['nike','shoes']);assert.equal(safeSearch('Nike shoes',vocabulary),'nike shoes');
 for(const query of ['person@example.com','call 1234567890','unknown person','https://example.com'])assert.equal(safeSearch(query,vocabulary),'Other searches');
});
test('private raw bucket reads and rate limit use bounded commands',async()=>{
 const {createStore}=require('../lib/trending-store');let commands;
 const store=createStore({TRENDING_ENABLED:'1',KV_REST_API_URL:'https://example.com',KV_REST_API_TOKEN:'test'},async(url,opts)=>{commands=JSON.parse(opts.body);return {ok:true,json:async()=>commands[0]==='EVAL'?{result:21}:commands.map(()=>({result:[]}))};});
 assert.equal(await store.allowDashboard('address'),false);const result=await store.dashboard(0);assert.equal(commands.length,14);assert.equal(result.days.length,7);assert.equal(result.signals.length,7);
});
test('dashboard API never reads or returns reports before authorization, including cached data',async()=>{
 const {createDashboardHandler}=require('../lib/dashboard-api');const password='unique-test-password-long-enough';let reads=0,blocked=false;
 const store={dashboardBlocked:async()=>blocked,allowDashboard:async()=>true,dashboard:async()=>{reads++;return {days:[],signals:[]};}};
 const handler=createDashboardHandler({items:[],getPassword:()=>password,getStore:()=>store});
 async function call(authorization,method='GET'){const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;}};await handler({method,headers:{authorization}},res);return res;}
 assert.equal((await call()).code,401);assert.equal(reads,0);assert.equal((await call('Bearer '+password)).code,200);assert.equal(reads,1);
 assert.equal((await call('Bearer wrong')).code,401);assert.equal(reads,1);assert.equal((await call('Bearer '+password)).code,200);assert.equal(reads,1);
 blocked=true;assert.equal((await call('Bearer '+password)).code,200);assert.equal((await call('Bearer wrong')).code,429);assert.equal((await call(null,'POST')).code,405);
});

test('dashboard rates use sampled clicks while totals retain all clicks and legacy views stay excluded',()=>{
 const data=report([{id:'a',name:'A'}],[{'a:view':9000,'a:sample_view':100,'a:sample_click':10,'a:click':500,'a:save':50}],[]);
 assert.deepEqual(data.totals,{views:100,clicks:500,saves:50});assert.equal(data.mostClicked[0].clickRate,.1);
});
