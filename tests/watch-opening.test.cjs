const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {items}=require('../lib/regional-catalogue');
const opening=require('../data/watch-opening.json');
const {weidianId}=require('../lib/weidian-images');
const {filterAndSort}=require('../lib/catalogue');
const {rankRecommended}=require('../lib/trending');
const {prepareInitialCatalogue}=require('../lib/initial-catalogue');
const {applyWatchOpening}=require('../lib/watch-opening');
const list=filterAndSort(items.filter(i=>i.visibility!=='hidden'),'super clone watches','default');

test('first 15 live cards follow spreadsheet rows, including three shared-link options',()=>{
 assert.equal(list.length,101);
 assert.deepEqual(list.slice(0,15).map(i=>weidianId(i.link)),opening.map(r=>weidianId(r.link)));
 assert.equal(new Set(list.map(i=>i.id)).size,list.length);
 for(let n=0;n<15;n++){
  const entry=opening[n],item=list[n];
  if(entry.image){assert.equal(item.image,entry.image);assert.equal(item.name,entry.name);assert.ok(fs.existsSync(path.join(__dirname,'../public',entry.image)));}
 }
 for(const [a,b] of [[1,2],[6,7],[10,11]]){
  assert.equal(list[a].link,list[b].link);assert.notEqual(list[a].id,list[b].id);assert.notEqual(list[a].image,list[b].image);
 }
 assert.ok(!list.some(i=>weidianId(i.link)==='7626350689'));
});

test('recommendations and server preview retain the opening despite popularity scores',()=>{
 const demand={status:'ready',seed:'test',adaptive:{scores:{[list[30].id]:1},low:[list[0].id]}};
 for(const snapshot of [{},demand]){
  assert.deepEqual(rankRecommended(list,snapshot).slice(0,15).map(i=>i.id),list.slice(0,15).map(i=>i.id));
  const preview=prepareInitialCatalogue(items,[],{category:'super clone watches'},snapshot);
  assert.deepEqual(preview.visibleIds.slice(0,15),list.slice(0,15).map(i=>i.id));
 }
 const prices=filterAndSort(list,'super clone watches','price-asc').map(i=>i.prices.USD);
 assert.deepEqual(prices,[...prices].sort((a,b)=>a-b));
});

test('variants inherit fresh prices and hidden status from their existing listing',()=>{
 const base=items.find(i=>weidianId(i.link)==='7629340798'&&!i.id.includes('-watch-'));
 const variants=applyWatchOpening([{...base,prices:{USD:123,CNY:800}}]);
 assert.equal(variants.length,2);assert.ok(variants.every(i=>i.prices.USD===123));
 assert.ok(variants.some(i=>i.id===base.id));
 const hidden=applyWatchOpening([{...base,visibility:'hidden'}]);
 assert.equal(hidden.length,1);assert.equal(hidden[0].visibility,'hidden');
});
