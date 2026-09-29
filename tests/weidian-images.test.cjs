const {test}=require('node:test');
const assert=require('node:assert/strict');
const {weidianId,extractImage,applyImages}=require('../lib/weidian-images');
const {categoriesFor}=require('../lib/catalogue');
test('collection order follows sheet tabs even when products appear in a different order',()=>{
 const items=[{category:'HOODIES',categories:['HOODIES','MAIN']},{category:'ZARA',categories:['ZARA']}];
 assert.deepEqual(categoriesFor(items,['MAIN','SUPER CLONE WATCHES','ZARA','HOODIES']).map(c=>c.label),['ZARA','HOODIES']);
 assert.deepEqual(categoriesFor(items.slice(0,1),['MAIN','ZARA','HOODIES']).map(c=>c.label),['HOODIES']);
});
test('only extracts exact Weidian IDs, including embedded Kakobuy destinations',()=>{
 assert.equal(weidianId('https://kakobuy.com/item/details?url='+encodeURIComponent('https://weidian.com/item.html?itemID=123')),'123');
 assert.equal(weidianId('https://shop123.v.weidian.com/item.html?itemID=123'),'123');
 assert.equal(weidianId('https://notweidian.com/item.html?itemID=123'),null);
 assert.equal(weidianId('https://item.taobao.com/item.htm?id=123'),null);
});
test('image metadata must match product ID and expected HTTPS image host',()=>{
 const html='&quot;item_head&quot;:&quot;https://si.geilicdn.com/product.jpg&quot;,&quot;item_head_thumb&quot;:&quot;x&quot;,&quot;item_id&quot;:&quot;123&quot;';
 assert.equal(extractImage(html,'123'),'https://si.geilicdn.com/product.jpg');
 assert.equal(extractImage(html,'456'),null);
 assert.equal(extractImage(html.replace('si.geilicdn.com','example.com'),'123'),null);
 assert.equal(extractImage('<img src="https://si.geilicdn.com/logo.jpg">','123'),null);
});
test('matching links apply to all copies of a product without changing purchase URLs',()=>{
 const link='https://weidian.com/item.html?itemID=123';const items=[{link,image:''},{link,image:'old'},{link:'https://example.com',image:'existing'}];
 const result=applyImages(items,{'123':{image:'https://si.geilicdn.com/photo.jpg'}});
 assert.equal(result[0].image,result[1].image);assert.equal(result[2].image,'existing');assert.equal(result[0].link,link);assert.equal(items[0].image,'');
});

test("verified Kakobuy short links map to their exact listing IDs", () => {
 assert.equal(weidianId("https://ikako.vip/dhh5r"), "7708795113");
 assert.equal(weidianId("https://ikako.vip/t3kda"), "7708806891");
 assert.equal(weidianId("https://ikako.vip/8xhgp"), "7711854130");
 assert.equal(weidianId("https://ikako.vip/tg9v7"), "7708856267");
 assert.equal(weidianId("https://ikako.vip/unknown"), null);
});
