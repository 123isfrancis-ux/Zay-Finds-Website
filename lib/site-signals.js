let enabled=false;
export function setSignalsEnabled(value){enabled=value===true;}
let session='',day='',pending=[],timer,seen=new Set();
if(typeof window!=='undefined'){
 window.addEventListener('pagehide',flush);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
}
export function siteSignal(event){
 if(!enabled||typeof window==='undefined'||navigator.doNotTrack==='1'||navigator.globalPrivacyControl||!window.crypto?.randomUUID)return;
 const today=new Date().toISOString().slice(0,10);
 if(day!==today){day=today;session=crypto.randomUUID();seen=new Set();pending=[];try{const previous=JSON.parse(sessionStorage.getItem('zay-signals')||'null');if(previous?.day===day&&/^[a-f0-9-]{36}$/.test(previous.session))session=previous.session;else sessionStorage.setItem('zay-signals',JSON.stringify({day,session}));}catch{}}
 if(event.type==='search_empty'&&(/@|https?:|www\.|\d{4}/i.test(event.query)||event.query.length>80))event={...event,query:'Other searches'};
 const key=event.type==='fit'?`${event.fit}:${event.action}`:JSON.stringify(event);if(seen.has(key)||seen.size>=200)return;seen.add(key);pending.push(event);
 clearTimeout(timer);timer=setTimeout(flush,800);
}

function flush(){
 if(!enabled){pending=[];return;}
 const events=pending.splice(0,20);
 if(events.length)fetch('/api/site-signals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session,events}),keepalive:true}).catch(()=>{});
 if(pending.length)timer=setTimeout(flush,800);
}
