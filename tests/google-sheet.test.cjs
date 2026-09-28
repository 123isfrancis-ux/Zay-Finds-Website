const {test}=require('node:test');
const assert=require('node:assert/strict');
const {importSheet,searchableItems}=require('../lib/google-sheet');
const {categoriesFor,filterAndSort}=require('../lib/catalogue');
const cell=(text)=>({formattedValue:text});
const money=n=>({effectiveValue:{numberValue:n}});
function sheet(title,id,rows){return {properties:{title,sheetId:id},data:[{rowData:rows.map(values=>({values}))}]};}
test('maps both layouts, preserves exact prices/affiliate links, skips banners and merges duplicate memberships',()=>{
 const link={hyperlink:'https://example.com/item?affcode=keep'};
 const row=[cell('A find'),{},link,money(160),money(23.83)];
 const data=importSheet({sheets:[sheet('MAIN',1,[[cell('SIGN UP'),link],row]),sheet('HOODIES',2,[row]),sheet('WATCHES',3,[[cell('Watch'),link,money(1600),money(238.33)]])]});
 assert.equal(data.items.length,2);assert.equal(data.items[0].prices.CNY,160);assert.equal(data.items[1].prices.USD,238.33);
 assert.deepEqual(data.items[0].categories,['MAIN','HOODIES']);assert.equal(data.items[0].source.row,2);
 assert.equal(data.items[0].link,link.hyperlink);
 const items=searchableItems(data.items);assert.equal(categoriesFor(items).length,3);assert.equal(filterAndSort(items,'hoodies','default').length,1);
});
test('extracts image formulas and rejects unsafe hyperlinks; IDs survive inserted headings',()=>{
 const row=[cell('Top'),{userEnteredValue:{formulaValue:'=IMAGE("https://example.com/top.jpg")'}},{userEnteredValue:{formulaValue:'=HYPERLINK("https://example.com/top";"LINK")'}},money(50),money(7)];
 const first=importSheet({sheets:[sheet('MAIN',1,[row])]});
 const next=importSheet({sheets:[sheet('MAIN',1,[[cell('Heading')],row,[cell('Bad'),{hyperlink:'javascript:alert(1)'},money(1),money(2)]])]});
 assert.equal(first.items[0].image,'https://example.com/top.jpg');assert.equal(first.items[0].id,next.items[0].id);assert.equal(next.items.length,1);
});
