const test=require('node:test');
const assert=require('node:assert/strict');
const {items}=require('../lib/regional-catalogue');
const {weidianId}=require('../lib/weidian-images');
const {filterAndSort}=require('../lib/catalogue');
const {homeSections,collectionItems}=require('../lib/home-collections');
const {audienceFor}=require('../lib/audience');
const batch=items.filter(i=>i.source.spreadsheetId==='1ISOjOe2mWaPv1ko9OfpEc40M1VwHvYtOebb86HrImQY'&&i.source.sheetId===111624443&&i.source.row>=98&&i.source.row<=145);
test('48 new watches retain unique destination links, source rows, photos and starting watch prices',()=>{
 assert.equal(batch.length,48);
 assert.equal(new Set(batch.map(i=>weidianId(i.link))).size,48);
 for(const item of batch){
  assert.ok(item.categories.includes('SUPER CLONE WATCHES'));
  assert.match(item.image,/^https:\/\/si\.geilicdn\.com\//);
  assert.ok(item.prices.CNY>0&&item.prices.USD>0);
  assert.equal(new URL(item.link).searchParams.get('affcode'),'ZAYFINDS');
  assert.ok(item.addedAt);assert.equal(item.personallyBought,false);
 }
 assert.equal(batch.find(i=>weidianId(i.link)==='7869102979').prices.CNY,500);
 assert.equal(batch.find(i=>weidianId(i.link)==='7872339968').prices.CNY,400);
 assert.equal(batch.filter(i=>audienceFor(i)==='women').length,3);
});
test('new watches are spread across the complete category and only three appear in the homepage preview',()=>{
 const newIds=new Set(batch.map(i=>i.id));
 const ordered=filterAndSort(items,'super clone watches','default');
 assert.equal(ordered.length,99);
 assert.equal(ordered.filter(i=>newIds.has(i.id)).length,48);
 for(let start=0;start<ordered.length;start+=25){
  const quarter=ordered.slice(start,start+25);const count=quarter.filter(i=>newIds.has(i.id)).length;
  assert.ok(count>=10&&count<=14);
 }
 const homepage=homeSections(items,{},'USD',1).find(s=>s.key==='new').items;
 assert.equal(homepage.length,12);
 assert.deepEqual(homepage.filter(i=>newIds.has(i.id)).map(i=>weidianId(i.link)),['7869304257','7872343930','7872249078']);
 assert.equal(collectionItems(items,'new').filter(i=>newIds.has(i.id)).length,48);
});
