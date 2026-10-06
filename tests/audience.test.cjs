const test = require('node:test');
const assert = require('node:assert/strict');
const {audienceFor, audienceFromQuery} = require('../lib/audience');
const {categoriesFor, viewItems} = require('../lib/catalogue');
test('audience respects explicit labels, mixed products and neutral brands', () => {
  for (const name of ['Uniqlo Women Tee', "Women's Hoodie", 'Ladies Top']) assert.equal(audienceFor({name}), 'women');
  assert.equal(audienceFor({name:"Men’s Dress Shirt"}), 'men');
  for (const name of ['Men and Women Tee', 'Unisex Hoodie', 'Lululemon Pants', 'Zara Jacket', 'Dress Shoes']) assert.equal(audienceFor({name}), 'everyone');
  assert.equal(audienceFor({name:'Hoodie',categories:['ALO WOMEN']}), 'women');
  assert.equal(audienceFor({name:'Men Hoodie',categories:['ALO WOMEN']}), 'men');
  assert.equal(audienceFor({name:'Women Tee',audience:'everyone'}), 'everyone');
});
test('shared links override remembered preferences and reject invalid input', () => {
  assert.equal(audienceFromQuery(undefined,'women'),'women');
  assert.equal(audienceFromQuery('everyone','women'),'everyone');
  assert.equal(audienceFromQuery(['men','women'],'women'),'men');
  assert.equal(audienceFromQuery('invalid','women'),'everyone');
});
test('audience scopes category availability and saved view without deleting saves', () => {
  const items=[{id:'w',name:'Top',categories:['ALO WOMEN'],visibility:'catalog',_search:'top'},{id:'s',name:'Watch',categories:['WATCHES'],visibility:'catalog',_search:'watch'}];
  const saved=new Set(['w','s']);
  const men=items.filter(i=>audienceFor(i)!=='women');
  assert.deepEqual(categoriesFor(men).map(c=>c.value),['watches']);
  assert.deepEqual(viewItems(men,'saved',saved).map(i=>i.id),['s']);
  assert.deepEqual(viewItems(items,'saved',saved).map(i=>i.id),['w','s']);
});

 test('specific womenswear stays out of Men without misclassifying shared garment words',()=>{
  const {audienceFor}=require('../lib/audience');
  for(const name of ['Asymmetric lapel cut blouse','Off-shoulder top','Ribbed camisole','Lace bodysuit','Ballet flats','Halter neck top','Crop top'])assert.equal(audienceFor({name}),'women',name);
  for(const name of ['Mens tank top','Men’s cropped jacket','Mens compression leggings'])assert.equal(audienceFor({name}),'men',name);
  for(const name of ['Unisex hoodie','Tank 68 Keyboard','Cartier Tank','Dress shirt','Baby bodysuit'])assert.equal(audienceFor({name}),'everyone',name);
 });
 test('reviewed Lululemon womens pieces remain in Women and Everyone',()=>{
  const {audienceFor}=require('../lib/audience');
  const items=require('../lib/regional-catalogue').items.filter(i=>i.categories.includes('LULULEMON'));
  assert.equal(items.length,27);
  assert.ok(items.every(i=>audienceFor(i)==='women'));
  assert.equal(audienceFor({name:'Lululemon Mens Joggers',categories:['LULULEMON']}),'men');
 });
