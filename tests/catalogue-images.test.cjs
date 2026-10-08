const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,queue}=require('../scripts/catalogue-images.cjs');
test('reject mismatched product evidence and unexpected image hosts',()=>{
 const row={id:'123',source:'https://kakobuy.com/item/details?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D123',image:'https://si.geilicdn.com/image.jpg'};
 assert.equal(validate(row),row);
 const original={...row,source:'https://weidian.com/item.html?itemID=123'};
 assert.equal(validate(original),original);
 assert.throws(()=>validate({...original,id:'456'}));
 assert.throws(()=>validate({...original,source:'https://example.com/item.html?itemID=123'}));
 assert.throws(()=>validate({...row,id:'456'}));assert.throws(()=>validate({...row,image:'https://example.com/image.jpg'}));
});
test('completed watch category requires no browser lookups',()=>{
 const result=queue('SUPER CLONE WATCHES');assert.equal(result.total,99);assert.equal(result.withImages,99);assert.deepEqual(result.pending,[]);
});
