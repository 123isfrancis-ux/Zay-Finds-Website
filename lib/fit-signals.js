const definitions=require('../data/shop-the-fit.json');
const ACTIONS=['view','select','click','save','preview','swap','checklist'];
const READY_BUCKETS=['fast','good','moderate','slow'];
function readyBucket(ms){return ms<=1500?'fast':ms<=2500?'good':ms<=4000?'moderate':'slow';}
function fitSignalKey(event,ids,looks=definitions) {
 if(event?.type!=='fit'||typeof event.fit!=='string')return null;
 const look=looks.find(look=>look.id===event.fit);if(!look)return null;
 if(event.action==='ready')return READY_BUCKETS.includes(event.bucket)?`fit:${look.id}:ready_${event.bucket}`:null;
 if(!ACTIONS.includes(event.action))return null;
 if(['click','preview','swap'].includes(event.action)){
  const pieces=look.pieces.flatMap(p=>[p.id,...(p.alternatives||[]).map(a=>a.id)]);
  if(!ids.has(event.id)||!pieces.includes(event.id))return null;
 }
 return `fit:${look.id}:${event.action}`;
}
function fitReport(signals,looks=definitions){
 return looks.map(look=>{
  const counts=Object.fromEntries([...ACTIONS,...READY_BUCKETS.map(b=>'ready_'+b)].map(action=>[action,0]));
  for(const day of signals)for(const action of Object.keys(counts)){const n=Number(day[`fit:${look.id}:${action}`]);if(Number.isSafeInteger(n)&&n>0)counts[action]+=n;}
  const ready=READY_BUCKETS.reduce((sum,b)=>sum+counts['ready_'+b],0);
  return {id:look.id,title:look.title,...counts,clickRate:counts.view?counts.click/counts.view:null,ready,readyWithin2500:ready?(counts.ready_fast+counts.ready_good)/ready:null};
 });
}
module.exports={fitSignalKey,fitReport,readyBucket};
