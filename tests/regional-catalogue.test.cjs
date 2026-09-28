const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../lib/regional-catalogue');
function response() { return { headers: {}, setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.data=data;return this;} }; }
test('catalogue serves imported product data and source date without credentials', async()=>{
 const res=response(); await handler({method:'GET'},res);
 assert.equal(res.code,200); assert.equal(res.data.collections.length,17);
 assert.ok(res.data.items.length>3000); assert.ok(res.data.importedAt);
 assert.ok(res.data.items.every(i=>i._search && i._categories.length));
 assert.equal(res.data.items[0].prices.CNY,160);
 assert.match(res.data.items[0].link,/affcode=ecdru/);
});
test('catalogue rejects writes',async()=>{const res=response();await handler({method:'POST'},res);assert.equal(res.code,405);assert.equal(res.headers.Allow,'GET');});
