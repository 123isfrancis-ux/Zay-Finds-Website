const test=require('node:test');
const assert=require('node:assert/strict');
const {collectionItems,homeSections}=require('../lib/home-collections');
const {prepareInitialCatalogue}=require('../lib/initial-catalogue');
const {viewItems}=require('../lib/catalogue');
const {items,collections}=require('../lib/regional-catalogue');
const picks=require('../data/popular-picks.json');
test('popular edit preserves reviewed order, excludes unavailable products, and supports direct links',()=>{
 const copy=items.map(item=>item.id);
 assert.deepEqual(collectionItems(items,'popular').map(item=>item.id),picks);
 const initial=prepareInitialCatalogue(items,collections||[],{collection:'popular'},{});
 assert.equal(initial.collection,'popular');
 assert.deepEqual(initial.visibleIds,picks);
 const hidden=items.map(item=>item.id===picks[0]?{...item,visibility:'hidden'}:item);
 assert.ok(!homeSections(hidden,{},'USD',1)[0].items.some(item=>item.id===picks[0]));
 assert.deepEqual(items.map(item=>item.id),copy);
});
test('observed misspellings resolve to relevant catalogue products',()=>{
 for(const [query,expected] of [['richard millie',/richard mille/i],['ralp',/ralph/i],['chrome heart',/chrome heart/i]]){
  const result=viewItems(items,'all',new Set(),query);
  assert.ok(result.length>0,query);
  assert.ok(result.every(item=>expected.test(item.name+' '+(item.categories||[]).join(' '))),query);
 }
 for(const query of ['shoes','omega','bags','nike'])assert.ok(viewItems(items,'all',new Set(),query).length>0,query);
});
