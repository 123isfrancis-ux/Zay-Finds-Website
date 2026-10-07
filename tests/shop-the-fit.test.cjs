const test=require('node:test');const assert=require('node:assert/strict');
const {availableLooks,reviewedLooks,lookTotal,saveLook}=require('../lib/shop-the-fit');
const catalogue=require('../lib/regional-catalogue').items;
const definitions=require('../data/shop-the-fit.json');
test('published looks resolve complete outfits from visible photographed catalogue items',()=>{
 const looks=[...availableLooks(catalogue,'men'),...availableLooks(catalogue,'women')];
 assert.equal(looks.length,10);
 for(const look of looks){assert.equal(look.pieces.length,3);assert.ok(look.pieces.every(p=>p.item.link&&p.item.image&&p.item.visibility!=='hidden'));assert.ok(lookTotal(look.pieces,'USD',1.4)>0);}
 assert.equal(new Set(definitions.map(l=>l.id)).size,definitions.length);
});
test('Everyone and Men show the same looks, with women only in Women mode',()=>{
 assert.deepEqual(availableLooks(catalogue),availableLooks(catalogue,'men'));
 assert.deepEqual(reviewedLooks(catalogue),reviewedLooks(catalogue,'men'));
 assert.deepEqual(reviewedLooks(catalogue,'women').map(l=>l.id),['weekend-streetwear','night-out','gym-to-coffee','city-chic']);
 assert.deepEqual(availableLooks(catalogue,'men').map(l=>l.id),['streetwear','airport-fit','clean-everyday','going-out','designer-fit','smart-casual']);
 assert.deepEqual(availableLooks(catalogue,'women').map(l=>l.id),['weekend-streetwear','night-out','gym-to-coffee','city-chic']);
});
test('missing, hidden, unphotographed or incompatible pieces suppress complete look',()=>{
 const look=definitions[0], id=look.pieces[0].id;
 for(const patch of [{visibility:'hidden'},{image:null},{link:null},{audience:'women'}]){
 const changed=catalogue.map(i=>i.id===id?{...i,...patch}:i);
 assert.ok(!availableLooks(changed,'men').some(l=>l.id===look.id));
 }
 assert.ok(!availableLooks(catalogue.filter(i=>i.id!==id)).some(l=>l.id===look.id));
 assert.equal(availableLooks(catalogue,'everyone',[{...look,pieces:[look.pieces[0],look.pieces[0]]}]).length,0);
});
test('combined prices add displayed cents and never imply free missing pieces',()=>{
 const pieces=[{item:{prices:{USD:10.125}}},{item:{prices:{USD:20.125}}}];
 assert.equal(lookTotal(pieces,'USD',1.4),30.26);
 assert.equal(lookTotal([{item:{prices:{USD:1.005}}}],'USD',1.4),1.01);
 assert.equal(lookTotal(pieces,'CAD',1.4),42.35);
 assert.equal(lookTotal([...pieces,{item:{prices:{USD:0}}}],'USD',1.4),null);
 assert.equal(lookTotal(pieces,'CAD',NaN),null);
});
test('save whole look is additive, deduplicated and repeat-safe',()=>{
 const before=['existing','a'];const result=saveLook(before,['a','b','b','c']);
 assert.deepEqual(result,{ids:['existing','a','b','c'],added:['b','c'],status:'saved'});
 assert.deepEqual(before,['existing','a']);assert.equal(saveLook(result.ids,['a','b','c']).status,'already');
});
test('full Saved fails atomically without losing existing items or partially saving a look',()=>{
 const before=['a','b'];assert.deepEqual(saveLook(before,['c','d'],3),{ids:before,added:[],status:'full'});
 assert.equal(saveLook(before,['b','c'],3).status,'saved');
});

test('girls-sheet outfit products retain provenance and stay out of mens selection',()=>{
 const girls=catalogue.filter(i=>i.categories.includes('GIRLS FINDS'));
 assert.equal(girls.length,6);
 const {audienceFor}=require('../lib/audience');
 for(const item of girls){assert.equal(audienceFor(item),'women');assert.equal(item.source.spreadsheetId,'1ZtUsX9uzAuVxBZxoPPGXFbxlUZU9JJnsmOAlpaiNAcM');assert.ok(item.link.includes('ZAYFINDS'));}
 for(const look of definitions) for(const piece of look.pieces){assert.ok(piece.imageWidth>0&&piece.imageHeight>0);}
});
