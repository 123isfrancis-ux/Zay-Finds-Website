const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../scripts/refresh-weidian-images.cjs'),'utf8');
async function run(t,fetch){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zay-batch-'));fs.mkdirSync(path.join(root,'data'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const delays=[];const result=await new Promise((resolve,reject)=>vm.runInNewContext(source,{
 require:name=>name==='../lib/weidian-images'?{weidianId:link=>link,extractImage:()=> 'https://si.geilicdn.com/test.jpg'}:name==='../data/catalogue.json'?{items:['1','2','3','4'].map(link=>({link}))}:require(name),
 __dirname:path.join(root,'scripts'),process:{pid:123,exit:()=>reject(new Error('Unexpected skip'))},fetch,
 setTimeout:(callback,delay)=>{delays.push(delay);callback();},AbortSignal,Date,console:{log:resolve,error:reject}
 }));return {result:JSON.parse(result),state:JSON.parse(fs.readFileSync(path.join(root,'.image-sync-state.json'))),delays,root};
}
test('batch processes all eligible listings sequentially with one-second gaps',async t=>{
 let calls=0;const r=await run(t,async()=>{calls++;return {ok:true,status:200,url:'https://weidian.com',text:async()=>''};});
 assert.equal(calls,4);assert.deepEqual(r.delays,[1000,1000,1000]);assert.equal(r.result.completed,4);assert.ok(r.state.nextRunAt>Date.now()+290000);assert.equal(fs.existsSync(path.join(r.root,'.image-sync.lock')),false);
});
test('connection failure stops immediately and persists a five-minute cooldown',async t=>{
 let calls=0;const r=await run(t,async()=>{calls++;throw new Error('socket closed');});assert.equal(calls,1);assert.equal(r.state.backoffHours,0);assert.ok(r.state.nextRunAt>Date.now()+290000);
});
test('access denial pauses rather than retrying',async t=>{
 const r=await run(t,async()=>({status:403}));assert.equal(r.state.paused,true);assert.equal(r.result.completed,1);
});
test('long Retry-After is respected',async t=>{
 const r=await run(t,async()=>({status:429,headers:{get:()=> '7200'}}));assert.ok(r.state.nextRunAt>Date.now()+7100000);
});
