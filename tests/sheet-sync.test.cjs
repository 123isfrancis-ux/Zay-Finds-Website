const test=require('node:test'),assert=require('node:assert/strict');
const {SHEET_ID}=require('../lib/google-sheet');
const {baseline,mergeSheet}=require('../lib/sheet-sync');
const txt=s=>({formattedValue:s});
const product=(name,id,price=100)=>[txt(name),{hyperlink:`https://www.kakobuy.com/item/details?url=${encodeURIComponent('https://weidian.com/item.html?itemID='+id)}&affcode=ecdru`},{effectiveValue:{numberValue:price}},{effectiveValue:{numberValue:price/7}},{userEnteredValue:{formulaValue:'=IMAGE("https://example.com/'+id+'.jpg")'}}];
const workbook=rows=>({spreadsheetId:SHEET_ID,sheets:[{properties:{sheetId:1,title:'MAIN'},data:[{rowData:rows.map(values=>({values}))}]}]});
function fixture(){
 const w=workbook([product('Original',123)]),state=baseline(w),s=Object.values(state.products)[0];
 return {workbook:w,state,catalogue:{items:[{id:'stable-saved-id',name:'Corrected website title',link:s.link,image:'/owner-photos/verified.jpg',prices:{CNY:100,USD:14.285714},price_usd:14.285714,category:'MAIN',categories:['MAIN'],visibility:'catalog',source:{sheetId:1,row:1}}],collections:['MAIN'],importedAt:'old'},dates:{123:'2026-01-01'},now:'2026-10-08T10:00:00Z'};
}
test('unchanged source preserves every catalogue byte and editorial correction',()=>{
 const f=fixture(),r=mergeSheet(f);assert.deepEqual(r.catalogue,f.catalogue);assert.deepEqual(r.dates,f.dates);assert.equal(r.changes.updated,0);
});
test('rename and price edit retain saved identity, photo, addition date and exact new price',()=>{
 const f=fixture();f.workbook=workbook([product('New name',123,150)]);const r=mergeSheet(f),i=r.catalogue.items[0];
 assert.equal(i.id,'stable-saved-id');assert.equal(i.name,'New name');assert.equal(i.prices.CNY,150);assert.equal(i.image,'/owner-photos/verified.jpg');assert.deepEqual(r.dates,f.dates);
 assert.equal(mergeSheet({...f,...r}).changes.updated,0);
});
test('row moves and recalculation below one cent do not redeploy products',()=>{
 const f=fixture(),p=product('Original',123);p[3].effectiveValue.numberValue+=.0001;f.workbook=workbook([[txt('Heading')],p]);assert.deepEqual(mergeSheet(f).catalogue,f.catalogue);
});
test('new item is added once with a stable identity, original link, image and addition date',()=>{
 const f=fixture();f.workbook=workbook([product('Original',123),product('New',456)]);const r=mergeSheet(f);assert.equal(r.changes.added,1);assert.equal(r.catalogue.items.length,2);assert.equal(r.dates['456'],f.now);
 const again=mergeSheet({...f,...r});assert.equal(again.changes.added,0);assert.deepEqual(again.catalogue,r.catalogue);
});
test('missing sheets, truncated sources, missing new photos and oversized batches fail without mutation',()=>{
 const f=fixture(),copy=structuredClone(f);assert.throws(()=>mergeSheet({...f,workbook:{spreadsheetId:SHEET_ID,sheets:[]}}),/missing/);
 assert.throws(()=>mergeSheet({...f,workbook:workbook([])}),/shrank/);
 const p=product('Incomplete',456);p[4]={};assert.throws(()=>mergeSheet({...f,workbook:workbook([product('Original',123),p])}),/photo/);
 assert.throws(()=>mergeSheet({...f,workbook:workbook([product('Original',123),...Array.from({length:101},(_,i)=>product('New '+i,1000+i))])}),/Large/);assert.deepEqual(f,copy);
});
test('missing products remain live; manually hidden products cannot be reactivated by sync',()=>{
 const rows=Array.from({length:10},(_,i)=>product('Product '+i,100+i));const f=fixture();f.workbook=workbook(rows);f.state=baseline(f.workbook);f.workbook=workbook(rows.slice(1));assert.deepEqual(mergeSheet(f).catalogue,f.catalogue);
 const g=fixture();g.catalogue.items[0].visibility='hidden';g.workbook=workbook([[txt('Name'),txt('Link'),txt('CNY'),txt('USD'),txt('Photo'),txt('Website status')],[...product('Original',123),txt('show')]]);assert.equal(mergeSheet(g).catalogue.items[0].visibility,'hidden');
});
test('explicit Website status hides and restores only items hidden by sync',()=>{
 const f=fixture(),header=[txt('Name'),txt('Link'),txt('CNY'),txt('USD'),txt('Photo'),txt('Website status')];f.workbook=workbook([header,[...product('Original',123),txt('hide')]]);const r=mergeSheet(f);assert.equal(r.catalogue.items[0].visibility,'hidden');
 const shown=mergeSheet({...f,...r,workbook:workbook([header,[...product('Original',123),txt('show')]])});assert.equal(shown.catalogue.items[0].visibility,'catalog');
});
test('intentional photo edits take precedence over old recovered photos',()=>{
 const f=fixture(),row=product('Original',123);row[4].userEnteredValue.formulaValue='=IMAGE("https://example.com/new.jpg")';f.workbook=workbook([row]);const r=mergeSheet(f);assert.equal(r.imageOverrides['stable-saved-id'],'https://example.com/new.jpg');
});
test('fragrances and malformed listing links cannot be newly published',()=>{
 const f=fixture(),bad=product('Bad link',456);bad[1].hyperlink='https://weidian.com/item.html?itemID=bad';f.workbook=workbook([product('Original',123),product('Designer perfume',789),bad]);const r=mergeSheet(f);assert.equal(r.changes.added,0);assert.equal(r.changes.invalid,1);
});
