const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const finds=require('../data/womens-source-finds.json');
const {collectionItems,homeSections}=require('../lib/home-collections');
const {audienceFor}=require('../lib/audience');
test('scoped source import retains every row and original source provenance',()=>{
 assert.equal(finds.length,495);
 assert.equal(new Set(finds.map(i=>i.id)).size,495);
 for(const [tab,count,category] of [['BAGS',68,"Women's Bags"],['ZARA',427,'Zara Womens']]){
  const rows=finds.filter(i=>i.source.tab===tab);assert.equal(rows.length,count);
  rows.forEach((i,n)=>{assert.equal(i.source.row,n+4);assert.deepEqual(i.categories,[category]);assert.equal(audienceFor(i),'women');assert.equal(new URL(i.link).searchParams.get('affcode'),'ZAYFINDS');assert(i.image);if(i.image.startsWith('/'))assert(fs.existsSync('public'+i.image));});
 }
});
test('imports stay out of full Just Added and homepage even with dates or featured IDs',()=>{
 const imports=finds.map(i=>({...i,addedAt:'2099-01-01T00:00:00Z'}));
 assert.deepEqual(collectionItems(imports,'new',null),[]);
 assert(!homeSections(imports,null,'USD',1).some(s=>s.key==='new'));
});
