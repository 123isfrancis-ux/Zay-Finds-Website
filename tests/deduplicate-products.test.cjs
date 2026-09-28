const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deduplicateProducts}=require('../lib/deduplicate-products');
const {searchableItems}=require('../lib/google-sheet');
test('shared listings merge categories and retain first identity, price, affiliate link and one available photo',()=>{
 const first={id:'a',name:'Santos',link:'https://kakobuy.com/item/details?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D123&affcode=one',image:'',prices:{USD:10},category:'MAIN',categories:['MAIN']};
 const second={...first,id:'b',name:'Skeleton',link:'https://weidian.com/item.html?itemID=123',image:'https://si.geilicdn.com/photo.jpg',prices:{USD:20},category:'Watches',categories:['Watches']};
 const result=deduplicateProducts([first,second,{...first,id:'c',link:'https://ikako.vip/other'}]);
 assert.equal(result.length,2);assert.equal(result[0].id,'a');assert.equal(result[0].link,first.link);assert.equal(result[0].prices.USD,10);
 assert.deepEqual(result[0].categories,['MAIN','Watches']);assert.equal(result[0].image,second.image);assert.match(searchableItems(result)[0]._search,/skeleton/);assert.deepEqual(first.categories,['MAIN']);
});
