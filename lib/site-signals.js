import { RETRY_MS, MAX_RETRY_MS } from './tracking-policy';
let enabled=false;
export function setSignalsEnabled(value){enabled=value===true;}
let session='',day='',pending=[],timer,seen=new Set(),sending=false,retryAt=0,failures=0;
function read(){try{return JSON.parse(localStorage.getItem('zay-signals-v2')||'null');}catch{return null;}}
function persist(keys){try{localStorage.setItem('zay-signals-v2',JSON.stringify({day,session,seen:keys}));}catch{}}
function keyOf(event){return event.type==='fit'?`fit:${event.fit}:${event.action}`:JSON.stringify(event);}
if(typeof window!=='undefined'){
 window.addEventListener('pagehide',flush);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
}
export function siteSignal(event){
 if(!enabled||typeof window==='undefined'||navigator.doNotTrack==='1'||navigator.globalPrivacyControl||!window.crypto?.randomUUID)return;
 if(event.type==='fit'&&!['view','click','save'].includes(event.action))return;
 if(!['fit','image_error','search_empty'].includes(event.type))return;
 const today=new Date().toISOString().slice(0,10);
 if(day!==today){
  day=today;session=crypto.randomUUID();seen=new Set();pending=[];retryAt=0;failures=0;
  const previous=read();
  if(previous?.day===day&&/^[a-f0-9-]{36}$/.test(previous.session)){session=previous.session;if(Array.isArray(previous.seen))seen=new Set(previous.seen.slice(0,200));}
  persist([...seen]);
 }
 if(event.type==='search_empty'&&(/@|https?:|www\.|\d{4}/i.test(event.query)||event.query.length>80))event={...event,query:'Other searches'};
 const key=keyOf(event),previous=read();
 if(seen.has(key)||(previous?.day===day&&previous.seen?.includes(key))||seen.size>=200)return;
 // Bound diagnostic noise to ten distinct failures of each kind per browser/day.
 if(event.type!=='fit'){
  const all=new Set([...seen,...(previous?.day===day&&Array.isArray(previous.seen)?previous.seen:[])]);
  if([...all].filter(k=>k.startsWith(`{"type":"${event.type}"`)).length>=10)return;
 }
 seen.add(key);pending.push(event);
 clearTimeout(timer);timer=setTimeout(flush,Math.max(800,retryAt-Date.now()));
}
async function flush(){
 if(!enabled){pending=[];return;}
 if(day!==new Date().toISOString().slice(0,10)){pending=[];return;}
 if(sending||!pending.length)return;
 if(Date.now()<retryAt){clearTimeout(timer);timer=setTimeout(flush,retryAt-Date.now());return;}
 const events=pending.splice(0,20),sentDay=day; sending=true;
 try{
  const response=await fetch('/api/site-signals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session,events}),keepalive:true,signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Unavailable');
  if(day===sentDay){failures=0;retryAt=0;const previous=read();persist([...new Set([...(previous?.day===day&&Array.isArray(previous.seen)?previous.seen:[]),...events.map(keyOf)])].slice(0,200));}
 }catch{
  if(day===sentDay){pending.unshift(...events);retryAt=Date.now()+Math.min(MAX_RETRY_MS,RETRY_MS*2**Math.min(failures++,3));}
 }finally{sending=false;}
 if(pending.length){clearTimeout(timer);timer=setTimeout(flush,Math.max(800,retryAt-Date.now()));}
}
