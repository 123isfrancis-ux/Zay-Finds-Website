const test=require('node:test'),assert=require('node:assert/strict');
const {reviewedLooks,applyLookSwaps,swapValue,filterLooks,lookTotal,quoteEstimate}=require('../lib/shop-the-fit');
const {fitSignalKey,fitReport,readyBucket}=require('../lib/fit-signals');
const catalogue=require('../lib/regional-catalogue').items;
const definitions=require('../data/shop-the-fit.json');
const {prepareInitialCatalogue}=require('../lib/initial-catalogue');
test('all curated alternatives have verified catalogue products, audience and known dimensions',()=>{
 const {audienceFor}=require('../lib/audience');
 for(const look of reviewedLooks(catalogue))for(const piece of look.pieces)for(const option of piece.alternatives){
  assert.ok(option.item.image&&option.item.link&&option.imageWidth>0&&option.imageHeight>0);
  assert.ok(audienceFor(option.item)==='everyone'||audienceFor(option.item)===look.audience);
  assert.notEqual(option.id,piece.id);
 }
});
test('approved swaps preserve identities, original links and totals in direct snapshots',()=>{
 const preview=prepareInitialCatalogue(catalogue,[],{view:'fits'},{});
 const full=reviewedLooks(catalogue).find(l=>l.id==='clean-everyday');
 const alt=full.pieces[1].alternatives[0];
 const value='1:'+alt.id;
 const look=applyLookSwaps(full,value);
 assert.equal(look.pieces[1].item.link,alt.item.link);
 assert.equal(look.pieces[1].id,alt.id);assert.equal(look.swap,value);
 assert.equal(lookTotal(look.pieces,'USD',1.4),lookTotal(applyLookSwaps(reviewedLooks(preview.items).find(l=>l.id===full.id),value).pieces,'USD',1.4));
 assert.equal(swapValue(look,1,full.pieces[1].id),'');
 assert.equal(applyLookSwaps(full,'1:unknown').pieces[1].id,full.pieces[1].id);
 assert.equal(applyLookSwaps(full,['1:'+alt.id]).swap,'');
});
test('unavailable originals retain look links, omit complete price, and only explicit approved choices restore completeness',()=>{
 const original=definitions.find(l=>l.id==='clean-everyday');
 const id=original.pieces[1].id;
 for(const patch of [{visibility:'hidden'},{image:null},{link:null},{audience:'women'}]){
  const rows=catalogue.map(item=>item.id===id?{...item,...patch}:item);
  const look=reviewedLooks(rows).find(l=>l.id===original.id);
  assert.equal(look.complete,false);assert.equal(look.pieces[1].item,null);assert.equal(lookTotal(look.pieces,'USD',1.4),null);
  const alt=look.pieces[1].alternatives[0];assert.ok(alt);
  const restored=applyLookSwaps(look,'1:'+alt.id);assert.equal(restored.complete,true);
  const snapshot=prepareInitialCatalogue(rows,[],{view:'fits',fit:original.id},{});
  assert.equal(reviewedLooks(snapshot.items).find(l=>l.id===original.id).complete,false);
 }
});
test('hidden alternatives and unreviewed shared-link swaps cannot become outfit pieces',()=>{
 const base=definitions.find(l=>l.id==='clean-everyday'),id=base.pieces[1].alternatives[0].id;
 const look=reviewedLooks(catalogue.map(item=>item.id===id?{...item,visibility:'hidden'}:item)).find(l=>l.id===base.id);
 assert.equal(look.pieces[1].alternatives.length,0);
 assert.equal(applyLookSwaps(look,'1:'+id).pieces[1].id,base.pieces[1].id);
});
test('budget filters use currency subtotal, never missing prices, and contexts differentiate looks',()=>{
 const looks=reviewedLooks(catalogue);
 assert.deepEqual(filterLooks(looks,{occasion:'Travel'},'USD',1.4).map(l=>l.id),['airport-fit']);
 assert.ok(filterLooks(looks,{budget:'100'},'USD',1.4).every(l=>lookTotal(l.pieces,'USD',1.4)<=100));
 const incomplete={...looks[0],complete:false,pieces:looks[0].pieces.map((p,i)=>i? p:{...p,item:null})};
 assert.equal(filterLooks([incomplete],{budget:'1000'},'USD',1.4).length,0);
 assert.equal(filterLooks(looks,{occasion:'Travel',layers:'Light'},'USD',1.4).length,0);
});
test('delivery estimates require explicit quotes and reject missing, negative or excessive amounts',()=>{
 assert.equal(quoteEstimate(100.01,'20.15','0'),120.16);
 for(const [subtotal,shipping,extras] of [[100,'','0'],[100,'0',''],[100,'-1','0'],[null,'1','2'],[100,'10001','0'],[100,'1e2','0'],[100,'1.234','0']])assert.equal(quoteEstimate(subtotal,shipping,extras),null);
});
test('outfit signals accept only published looks, allowed actions and products from that look',()=>{
 const ids=new Set(catalogue.filter(i=>i.visibility!=='hidden').map(i=>i.id));
 const look=definitions[0];
 assert.equal(fitSignalKey({type:'fit',fit:look.id,action:'view'},ids),'fit:streetwear:view');
 assert.equal(fitSignalKey({type:'fit',fit:look.id,action:'click',id:look.pieces[0].id},ids),'fit:streetwear:click');
 for(const event of [{type:'fit',fit:'arbitrary',action:'view'},{type:'fit',fit:look.id,action:'contact@email.com'},{type:'fit',fit:look.id,action:'click',id:'unknown'},{type:'fit',fit:look.id,action:'click',id:definitions[4].pieces[0].id},{type:'fit',fit:look.id,action:'ready',bucket:'1234'}])assert.equal(fitSignalKey(event,ids),null);
});
test('outfit report aggregates bounded action counters and coarse timing without invented results',()=>{
 const rows=fitReport([{'fit:streetwear:view':10,'fit:streetwear:click':2,'fit:streetwear:ready_good':3,'fit:streetwear:ready_slow':1},{'fit:streetwear:view':5,'fit:streetwear:save':1,'fit:streetwear:swap':-100}]);
 const row=rows[0];assert.equal(row.view,15);assert.equal(row.clickRate,2/15);assert.equal(row.ready,4);assert.equal(row.readyWithin2500,.75);assert.equal(row.swap,0);assert.equal(rows[1].clickRate,null);
 assert.deepEqual([1500,1501,2500,2501,4000,4001].map(readyBucket),['fast','good','good','moderate','moderate','slow']);
});
