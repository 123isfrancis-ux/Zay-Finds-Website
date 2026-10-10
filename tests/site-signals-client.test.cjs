const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(memory=new Map()){
 let time=Date.parse('2026-10-10T12:00:00Z'),ok=true;const sent=[];
 class Clock extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
 const uuid=()=> '12345678-1234-4123-8123-123456789ab1';
 const context=vm.createContext({require,Date:Clock,Set,JSON,Math,Array,Error,AbortSignal,
  window:{crypto:{randomUUID:uuid},addEventListener(){}},crypto:{randomUUID:uuid},navigator:{},
  document:{addEventListener(){},visibilityState:'visible'},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},
  setTimeout:()=>1,clearTimeout(){},fetch:async(url,options)=>{sent.push(JSON.parse(options.body));return {ok};}});
 const code=fs.readFileSync(require.resolve('../lib/site-signals'),'utf8').replace("import { RETRY_MS, MAX_RETRY_MS } from './tracking-policy';","const { RETRY_MS, MAX_RETRY_MS } = require('../lib/tracking-policy');").replaceAll('export function ','function ');
 vm.runInContext(code,context);context.setSignalsEnabled(true);
 return {context,sent,setOK:v=>ok=v,advance:ms=>{time+=ms;},memory};
}
test('diagnostics cap each failure kind and ignore retired fit events',async()=>{
 const {context:c,sent}=setup();
 for(let i=0;i<25;i++){c.siteSignal({type:'image_error',id:'p'+i});c.siteSignal({type:'search_empty',query:'shoe '+i,scope:'global'});}
 for(const action of ['ready','select','preview','swap','checklist'])c.siteSignal({type:'fit',fit:'look',action});
 await c.flush();assert.equal(sent.length,1);assert.equal(sent[0].events.length,20);
 assert.equal(sent[0].events.filter(e=>e.type==='image_error').length,10);assert.equal(sent[0].events.filter(e=>e.type==='fit').length,0);
});
test('signals retry after failure and deduplicate confirmed events after reload',async()=>{
 const state=setup(),c=state.context;state.setOK(false);
 c.siteSignal({type:'fit',fit:'look',action:'save'});await c.flush();await c.flush();assert.equal(state.sent.length,1);
 state.advance(60000);state.setOK(true);await c.flush();assert.equal(state.sent.length,2);
 assert.deepEqual(state.sent[0],state.sent[1]);
 const reload=setup(state.memory);reload.context.siteSignal({type:'fit',fit:'look',action:'save'});await reload.context.flush();assert.equal(reload.sent.length,0);
});
test('signals respect privacy preferences and drop old-day pending events',async()=>{
 const state=setup(),c=state.context;c.navigator.globalPrivacyControl=true;c.siteSignal({type:'image_error',id:'a'});await c.flush();assert.equal(state.sent.length,0);
 c.navigator.globalPrivacyControl=false;c.siteSignal({type:'image_error',id:'a'});state.advance(86400000);await c.flush();assert.equal(state.sent.length,0);
});
