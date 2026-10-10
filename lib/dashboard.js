const {createHash,timingSafeEqual}=require('node:crypto');
const {fitReport}=require('./fit-signals');
function authorized(header,password){
 if(typeof password!=='string'||password.length<24||typeof header!=='string'||header.length>512)return false;
 return timingSafeEqual(createHash('sha256').update(header).digest(),createHash('sha256').update('Bearer '+password).digest());
}
function report(items,days,signals,now=Date.now()){
 const rows=items.filter(i=>i.visibility!=='hidden').map(item=>{
  const row={id:item.id,name:item.name,link:item.link,image:item.image,views:0,clicks:0,saves:0,sampledClicks:0,imageErrors:0};
  for(const day of days)for(const kind of ['sample_view','sample_click','click','save']){const n=Number(day[`${item.id}:${kind}`]);if(Number.isSafeInteger(n)&&n>0)row[{sample_view:'views',sample_click:'sampledClicks',click:'clicks',save:'saves'}[kind]]+=n;}
  for(const day of signals){const n=Number(day['image:'+item.id]);if(Number.isSafeInteger(n)&&n>0)row.imageErrors+=n;}
  row.clickRate=row.views?row.sampledClicks/row.views:null;return row;
 });
 const totals=rows.reduce((sum,r)=>({views:sum.views+r.views,clicks:sum.clicks+r.clicks,saves:sum.saves+r.saves}),{views:0,clicks:0,saves:0});
 const searches={};for(const day of signals)for(const [key,value]of Object.entries(day)){const n=Number(value);if(key.startsWith('search:')&&Number.isSafeInteger(n)&&n>0)searches[key.slice(7)]=(searches[key.slice(7)]||0)+n;}
 return {measurement:{sampleRate:0.2,views:'sampled exposures',retentionDays:7},fits:fitReport(signals),generatedAt:new Date(now).toISOString(),totals,mostClicked:rows.filter(r=>r.clicks).sort((a,b)=>b.clicks-a.clicks).slice(0,20),mostSaved:rows.filter(r=>r.saves).sort((a,b)=>b.saves-a.saves).slice(0,20),lowEngagement:rows.filter(r=>r.views>=30&&r.clickRate<.05).sort((a,b)=>b.views-a.views).slice(0,20),photoIssues:rows.filter(r=>r.imageErrors||(!r.image&&(r.views||r.clicks||r.saves))).sort((a,b)=>b.clicks+b.saves-a.clicks-a.saves||b.imageErrors-a.imageErrors).slice(0,30),searches:Object.entries(searches).map(([term,count])=>({term,count})).sort((a,b)=>b.count-a.count).slice(0,30)};
}
function safeSearch(query,vocabulary){
 if(typeof query!=='string'||query.length>80||/@|https?:|www\.|\d{4}/i.test(query))return 'Other searches';
 const words=query.toLowerCase().replace(/[^a-z -]/g,' ').split(/\s+/).filter(Boolean);
 return words.length&&words.length<=6&&words.every(w=>vocabulary.has(w))?words.join(' '):'Other searches';
}
module.exports={authorized,report,safeSearch};
