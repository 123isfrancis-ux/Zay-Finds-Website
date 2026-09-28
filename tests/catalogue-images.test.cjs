const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,queue}=require('../scripts/catalogue-images.cjs');
test('reject mismatched product evidence and unexpected image hosts',()=>{
 const row={id:'123',source:'https://kakobuy.com/item/details?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D123',image:'https://si.geilicdn.com/image.jpg'};
 assert.equal(validate(row),row);
 assert.throws(()=>validate({...row,id:'456'}));assert.throws(()=>validate({...row,image:'https://example.com/image.jpg'}));
});
test('completed watch category requires no browser lookups',()=>{
 const result=queue('SUPER CLONE WATCHES');assert.equal(result.total,51);assert.equal(result.withImages,51);assert.deepEqual(result.pending,[]);
});
