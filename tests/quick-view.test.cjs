const test=require('node:test'),assert=require('node:assert/strict');
const {relatedFinds}=require('../lib/quick-view');
const make=(id,patch={})=>({id,name:id,categories:['MAIN','ZARA'],image:'photo',link:id,...patch});
test('related finds respect audience, availability and distinct listings',()=>{
 const current=make('a'),rows=[current,make('duplicate',{link:'a'}),make('hidden',{visibility:'hidden'}),make('missing',{image:null}),make('women',{name:'Women Shirt'}),make('other',{categories:['MAIN','Shoes']}),make('b'),make('c',{link:'b'}),make('d')];
 assert.deepEqual(relatedFinds(current,rows,'men').map(i=>i.id),['b','d']);
 assert.ok(relatedFinds(current,rows,'women').some(i=>i.id==='women'));
 assert.equal(relatedFinds(make('main',{categories:['MAIN']}),rows).length,0);
 assert.equal(relatedFinds(current,Array.from({length:10},(_,i)=>make('p'+i))).length,4);
});
