const {test}=require('node:test');
const assert=require('node:assert/strict');
const {restoreSearchFields,cardImage,boundedRanking}=require('../lib/catalogue-delivery');
const handler=require('../lib/regional-catalogue');
test('lean delivery excludes hidden products while restoring identical search and shopping fields',async()=>{
 let data;await handler({method:'GET',query:{compact:'2'}},{setHeader(){},status(){return this;},json(v){data=v;}});
 const expected=handler.items.filter(i=>i.visibility!=='hidden');const restored=restoreSearchFields(data.items);
 assert.equal(restored.length,expected.length);
 for(let i=0;i<restored.length;i++)for(const key of ['id','name','link','image','prices','categoryOrder','personallyBought','_search','_category','_categories'])assert.deepEqual(restored[i][key],expected[i][key]);
 assert.ok(data.items.every(i=>!('_search' in i)));
});
test('modern thumbnails preserve original URLs and support original-format fallback',()=>{
 const source='https://si.geilicdn.com/photo.png?w=900&h=400';
 const modern=new URL(cardImage(source));assert.equal(modern.pathname,'/photo.png.webp');assert.equal(modern.searchParams.get('w'),'400');assert.equal(modern.searchParams.get('h'),'400');
 assert.equal(new URL(cardImage(source,false)).pathname,'/photo.png');
 assert.equal(new URL(cardImage('https://si.geilicdn.com/photo.jpg.webp')).pathname,'/photo.jpg.webp');
 assert.equal(cardImage('/owner-photos/photo.jpg'),'/owner-photos/photo.jpg');
 assert.equal(cardImage('https://example.com/photo.png'),'https://example.com/photo.png');
});
test('slow ranking cannot delay catalogue indefinitely and fast rankings are preserved',async()=>{
 const ready={status:'ready',scores:{a:.8}};
 assert.equal(await boundedRanking(Promise.resolve(ready)),ready);
 assert.equal((await boundedRanking(new Promise(()=>{}),5)).status,'unavailable');
});


test('laptop aliases work in server catalogue and restored compact delivery', () => {
 const {items}=require('../lib/regional-catalogue');
 const {viewItems}=require('../lib/catalogue');
 const laptop=items.find(item=>item.id==='85882f1ca1b571d0e6be1bbf');
 assert.ok(laptop);
 const restored=restoreSearchFields([{...laptop,_search:undefined}]);
 for(const query of ['mac','macbook','mac book','computer','computers','notebook','apple laptop']) {
  assert.equal(viewItems([laptop],'all',new Set(),query).length,1,query);
  assert.equal(viewItems(restored,'all',new Set(),query).length,1,query);
 }
 const caseItem=items.find(item=>item.name==='Apple Laptop Case');
 assert.equal(viewItems([caseItem],'all',new Set(),'macbook').length,0);
 assert.equal(viewItems([{...laptop,visibility:'hidden'}],'all',new Set(),'macbook').length,0);
});
