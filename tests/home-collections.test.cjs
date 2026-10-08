const test=require('node:test');const assert=require('node:assert/strict');
const {homeSections,collectionItems,recordAddedDates,normalizeCollection}=require('../lib/home-collections');
const {audienceFor}=require('../lib/audience');
const make=(id,extra={})=>({id,name:id,image:'photo',visibility:'catalog',prices:{USD:10},categories:['Shared'],...extra});
test('homepage uses honest cold-start labels and only visible photographed products',()=>{
 const rows=[make('a'),make('hidden',{visibility:'hidden',personallyBought:true}),make('blank',{image:null,personallyBought:true})];
 const shelves=homeSections(rows,{status:'learning',scores:{a:.5}},'USD',1.4);
 assert.ok(!shelves.some(s=>s.key==='explore'||s.key==='trending'));
 assert.ok(!shelves.some(s=>s.key==='bought'||s.key==='new'));
 assert.deepEqual(shelves.flatMap(s=>s.items.map(i=>i.id)),['a']);
});
test('Trending section contains only proven scored products in demand order',()=>{
 const d={status:'ready',scores:{a:.3,b:.6,hidden:.9}};
 const rows=[make('a'),make('b'),make('new'),make('hidden',{visibility:'hidden'})];
 assert.deepEqual(collectionItems(rows,'trending',d).map(i=>i.id),['b','a']);
 assert.equal(homeSections(rows,d,'USD',1)[0].title,'Trending This Week');
});
test('budget collection applies strict threshold in the selected display currency',()=>{
 const rows=[make('a',{prices:{USD:20}}),make('exact',{prices:{USD:25}}),make('cheap',{prices:{USD:10}}),make('zero',{prices:{USD:0}}),make('unknown',{prices:{}})];
 assert.deepEqual(collectionItems(rows,'budget',null,'USD',1.4).map(i=>i.id),['a','cheap']);
 assert.deepEqual(collectionItems(rows,'budget',null,'CAD',1.4).map(i=>i.id),['cheap']);
 assert.equal(homeSections(rows,{},'CAD',1.4).find(s=>s.key==='budget').title,'Under $25 CAD');
});
test('Just Added uses known dates and mixes collections within an addition batch',()=>{
 const rows=[make('unknown'),make('bad',{addedAt:'invalid'}),...['lulu','uniqlo','alo'].flatMap(category=>Array.from({length:6},(_,i)=>make(category+i,{categories:[category],addedAt:'2026-10-05T21:06:42Z'}))),make('old',{addedAt:'2026-09-01T00:00:00Z'})];
 const copy=JSON.stringify(rows);
 assert.equal(collectionItems(rows,'new')[0].id,'lulu0');
 const shelf=homeSections(rows,{},'USD',1).find(s=>s.key==='new');
 assert.deepEqual(shelf.items.map(i=>i.id),['lulu0','uniqlo0','alo0','lulu1','uniqlo1','alo1','lulu2','uniqlo2','alo2','lulu3','uniqlo3','alo3']);
 assert.equal(JSON.stringify(rows),copy);
});
test('audience scoping excludes opposite-audience items from every shelf',()=>{
 const rows=[make('men',{name:'Men Tee',addedAt:'2026-10-05',personallyBought:true}),make('women',{name:'Women Tee',addedAt:'2026-10-05',personallyBought:true}),make('shared')];
 for(const audience of ['men','women']) {
 const scoped=rows.filter(i=>audienceFor(i)==='everyone'||audienceFor(i)===audience);
 assert.ok(homeSections(scoped,{status:'ready',scores:{men:.2,women:.3}},'USD',1).every(s=>s.items.every(i=>i.id!==(audience==='men'?'women':'men'))));
 }
});
test('addition ledger preserves dates and does not mark existing or renamed listings as new',()=>{
 const old=make('old',{link:'https://weidian.com/item.html?itemID=123'});
 const changed={...old,id:'renamed',name:'Renamed'};
 const fresh=make('new',{link:'https://weidian.com/item.html?itemID=456'});
 const dates=recordAddedDates([old],[changed,fresh],{'123':'2026-09-01'},'2026-10-05');
 assert.deepEqual(dates,{'123':'2026-09-01','456':'2026-10-05'});
 assert.deepEqual(recordAddedDates([], [fresh],dates,'2026-10-06'),dates);
 assert.equal(normalizeCollection(['new','budget']),'new');assert.equal(normalizeCollection('bad'),'');
});
test('new product dates survive compact API and match the dated imports',()=>{
 const rows=require('../lib/regional-catalogue').items;
 assert.equal(rows.filter(i=>i.addedAt).length,254);
 const handler=require('../lib/regional-catalogue');let payload;
 handler({method:'GET',query:{compact:'1'}},{setHeader(){},status(){return this;},json(value){payload=value;}});
 assert.equal(payload.items.filter(i=>i.addedAt).length,254);
});

test('Shop the Fit view survives shared links',()=>{
 assert.equal(require('../lib/catalogue').catalogueFiltersFromQuery({view:'fits'}).view,'fits');
});

test('editorial Just Added picks are mixed, unique, scoped, and included in See all',()=>{
 const rows=require('../lib/regional-catalogue').items;
 const picks=require('../data/just-added-picks.json');
 const shelf=homeSections(rows,{},'USD',1).find(s=>s.key==='new').items;
 assert.equal(shelf.length,12);
 assert.equal(new Set(shelf.map(i=>i.id)).size,12);
 assert.deepEqual(shelf.filter(i=>picks.includes(i.id)).map(i=>i.id),picks);
 for(const id of picks)assert.ok(collectionItems(rows,'new').some(i=>i.id===id));
 const hidden=rows.map(i=>picks.includes(i.id)?{...i,visibility:'hidden'}:i);
 assert.ok(homeSections(hidden,{},'USD',1).find(s=>s.key==='new').items.every(i=>!picks.includes(i.id)));
 for(const audience of ['men','women']) {
  const scoped=rows.filter(i=>audienceFor(i)==='everyone'||audienceFor(i)===audience);
  assert.ok(homeSections(scoped,{},'USD',1).find(s=>s.key==='new').items.every(i=>audienceFor(i)!==(audience==='men'?'women':'men')));
 }
});
