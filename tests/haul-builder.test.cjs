const test=require('node:test'),assert=require('node:assert/strict');
const {cleanBoards,addToBoard,resolveHaul,subtotal,shareHash,readSharedHaul}=require('../lib/haul-builder');
test('corrupt stored boards cannot break saved finds or exceed limits',()=>{
 assert.deepEqual(cleanBoards(null),[]);
 assert.deepEqual(cleanBoards([{id:'haul-ok',name:' Weekend ',ids:['a','a',null,'<script>']},{id:'haul-ok',name:'Duplicate',ids:[]}]),[{id:'haul-ok',name:'Weekend',ids:['a']}]);
});
test('board additions deduplicate and reject overflow atomically',()=>{
 const board={id:'haul-ok',name:'Trip',ids:['a']};
 assert.equal(addToBoard(board,['a']).status,'already');assert.deepEqual(addToBoard(board,['a','b']).board.ids,['a','b']);
 const full={...board,ids:Array.from({length:100},(_,i)=>'p'+i)};assert.equal(addToBoard(full,['extra']).board,full);
 assert.deepEqual(board.ids,['a']);
});
test('shared links round trip unicode names and reject malformed or oversized payloads',()=>{
 const board={name:'Été 🌴',ids:['a','b']};assert.deepEqual(readSharedHaul(shareHash(board)),board);
 for(const hash of ['#haul=%','x','#haul='+encodeURIComponent(JSON.stringify({v:2,ids:['a']})),'#haul='+encodeURIComponent(JSON.stringify({v:1,ids:['a','a']})),'#haul='+'x'.repeat(16000)])assert.equal(readSharedHaul(hash),null);
});
test('hauls resolve only available listings and subtotal unknown prices honestly',()=>{
 const items=[{id:'a',link:'seller',prices:{USD:10.125}},{id:'b',link:'seller',prices:{}},{id:'hidden',link:'seller',visibility:'hidden'}];
 assert.deepEqual(resolveHaul(['a','b','hidden','missing'],items).map(i=>i.id),['a','b']);
 assert.deepEqual(subtotal(items.slice(0,2),'USD',1.4),{amount:10.13,unknown:1});
 assert.deepEqual(subtotal([items[0]],'CAD',1.4),{amount:14.18,unknown:0});
 assert.deepEqual(subtotal([items[0]],'CAD',NaN),{amount:0,unknown:1});
});
