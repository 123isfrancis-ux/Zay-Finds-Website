const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../lib/regional-catalogue');
function response() { return { headers: {}, setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.data=data;return this;} }; }
test('catalogue serves imported product data and source date without credentials', async()=>{
 const res=response(); await handler({method:'GET'},res);
 assert.equal(res.code,200); assert.equal(res.data.collections.length,21);
 assert.ok(res.data.items.length>3000); assert.ok(res.data.importedAt);
 assert.ok(res.data.items.every(i=>i._search && Array.isArray(i._categories)));
 assert.equal(res.data.items[0].prices.CNY,160);
 assert.match(res.data.items[0].link,/affcode=ZAYFINDS/);
});
test('catalogue rejects writes',async()=>{const res=response();await handler({method:'POST'},res);assert.equal(res.code,405);assert.equal(res.headers.Allow,'GET');});

test('personally bought labels follow exact spreadsheet listing matches and preserve hidden items', async()=>{
 const res=response(); await handler({method:'GET'},res);
 const {weidianId}=require('../lib/weidian-images');
 const marked=new Set(require('../data/personally-bought.json').map(key=>key.startsWith('http')?require('../lib/affiliate').affiliateLink(key):key));
 for(const item of res.data.items) assert.equal(item.personallyBought,marked.has(weidianId(item.link)||item.link));
 assert.equal(res.data.items.find(i=>weidianId(i.link)==='7626350689').visibility,'hidden');
 assert.equal(res.data.items.filter(i=>i.personallyBought && i.visibility!=='hidden').length,160);
});

test('Hoodies cleanup changes only that membership and preserves every product and other category',async()=>{
 const res=response();await handler({method:'GET'},res);
 const {deduplicateProducts}=require('../lib/deduplicate-products');
 const original=deduplicateProducts(require('../data/catalogue.json').items);
 const allowed=new Set(require('../data/hoodie-products.json'));
 assert.equal(res.data.items.length,original.length+3);
 for(const before of original){
  const after=res.data.items.find(i=>i.id===before.id);
  assert.deepEqual(after.categories.filter(c=>c!=='HOODIES'),before.categories.filter(c=>c!=='HOODIES'));
  assert.equal(after.categories.includes('HOODIES'),before.categories.includes('HOODIES')&&allowed.has(before.id));
  assert.equal(after.visibility,before.visibility);
  assert.equal(after.link,require('../lib/affiliate').affiliateLink(before.link));
 }
});

test('compact catalogue preserves display, filtering, order and price fields', async()=>{
 const full=response(), compact=response();
 await handler({method:'GET'},full); await handler({method:'GET',query:{compact:'1'}},compact);
 assert.equal(full.data.items.length,compact.data.items.length);
 for(let i=0;i<full.data.items.length;i++) for(const key of ['id','name','image','link','prices','_search','_categories','categoryOrder','personallyBought','visibility']) assert.deepEqual(compact.data.items[i][key],full.data.items[i][key]);
 assert.ok(JSON.stringify(compact.data).length<JSON.stringify(full.data).length);
});
test('conflicting historical names do not create misleading search matches',()=>{
 const {searchableItems}=require('../lib/google-sheet');
 assert.equal(searchableItems([{name:'Stud Earrings',category:'Accessories',categories:['Accessories'],alternateNames:['Blue Hoodie']}])[0]._search.includes('hoodie'),false);
});
