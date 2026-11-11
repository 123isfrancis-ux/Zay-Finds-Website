const { test } = require('node:test');
const assert = require('node:assert/strict');
const finds = require('../data/lulu-source-finds.json');
const { weidianId } = require('../lib/weidian-images');
const { queue } = require('../scripts/catalogue-images.cjs');
const { items } = require('../lib/regional-catalogue');
test('both Lululemon tabs retain all source rows and verified product identities', () => {
  assert.equal(finds.length, 159);
  assert.equal(finds.reduce((sum, item) => sum + item.source.rows.length, 0), 160);
  for (const [category, count] of [['LULULEMON', 27], ['LULU HIGH-END', 132]]) {
    assert.equal(finds.filter(item => item.category === category).length, count);
    assert.equal(items.filter(item => item.categories.includes(category)).length, count);
    assert.deepEqual(queue(category).pending, []);
  }
  for (const item of finds) {
    assert.equal(weidianId(item.link), item.source.productId);
    assert.equal(weidianId(item.source.photoSource), item.source.productId);
    assert.equal(new URL(item.image).hostname, 'si.geilicdn.com');
    assert.equal(new URL(item.link).searchParams.get('affcode'), 'ZAYFINDS');
    assert.ok(item.prices.CNY > 0 && item.prices.USD > 0);
    const delivered = items.find(row => row.id === item.id);
    assert.ok(delivered && delivered.image === item.image);
    assert.deepEqual(delivered.categories, item.categories);
    assert.equal(delivered.personallyBought, false);
  }
});
