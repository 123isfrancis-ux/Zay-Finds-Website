const test=require('node:test');
const assert=require('node:assert/strict');
const {prepareInitialCatalogue}=require('../lib/initial-catalogue');
const catalogue=require('../lib/regional-catalogue');
const {restoreSearchFields}=require('../lib/catalogue-delivery');
const {audienceFor}=require('../lib/audience');
const {homeSections}=require('../lib/home-collections');
const {usdToCad}=require('../data/exchange-rate.json');
const demand={status:'learning',scores:{},collect:true,seed:'2026-10-06'};
for(const audience of ['everyone','men','women'])test(`small ${audience} preview matches complete shelves`,()=>{
 const p=prepareInitialCatalogue(catalogue.items,[],{audience},demand);
 assert.ok(p.items.length<=72);
 assert.equal(p.visibleIds.length,24);
 assert.ok(p.total>p.items.length);
 const scoped=catalogue.items.filter(i=>audience==='everyone'||audienceFor(i)==='everyone'||audienceFor(i)===audience);
 assert.deepEqual(p.sections.map(s=>s.ids),homeSections(scoped,demand,'USD',usdToCad).map(s=>s.items.map(i=>i.id)));
 assert.ok(p.items.every(i=>i.visibility!=='hidden'));
 assert.ok(restoreSearchFields(p.items).every(i=>i._search));
});
test('direct category and bought links return matching products',()=>{
 const sample=catalogue.items.find(i=>i.personallyBought && i.visibility!=='hidden' && i.categories.some(c=>c.toLowerCase()!=='main'));
 const category=sample.categories.find(c=>c.toLowerCase()!=='main').toLowerCase();
 const p=prepareInitialCatalogue(catalogue.items,[],{view:'bought',category},demand);
 assert.ok(p.items.length>0);
 assert.ok(p.items.every(i=>i.personallyBought && i.categories.some(c=>c.toLowerCase()===category)));
 assert.equal(p.sections.length,0);
});
test('Saved never includes visitor data in shared HTML',()=>{
 const p=prepareInitialCatalogue(catalogue.items,[],{view:'saved'},demand);
 assert.equal(p.preview,false);assert.deepEqual(p.items,[]);assert.equal(p.counts.saved,0);
});
test('invalid category falls back to a usable catalogue',()=>{
 const p=prepareInitialCatalogue(catalogue.items,[],{category:'nonexistent'},demand);
 assert.equal(p.category,'');assert.equal(p.visibleIds.length,24);
});
