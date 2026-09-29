const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV, viewItems, categoriesFor, filterAndSort, catalogueFiltersFromQuery } = require('../lib/catalogue');

const csv = `id,name,category,price_usd,visibility
1,Weekly shoes, Shoes ,30, weekly
2,Legacy shoes,shoes,10,
3,Hidden shoes,Shoes,1,hidden
4,Weekly bag,Bags,20,weekly
5,Catalog shoe, Shoes,20,catalog
6,Unknown visibility, ,5,mistyped`;
const rows = parseCSV(csv);
const ids = items => items.map(item => item.id);

test('visibility and search exclude hidden products, including saved hidden IDs', () => {
  assert.deepEqual(ids(viewItems(rows, 'week', new Set())), ['1', '4']);
  assert.deepEqual(ids(viewItems(rows, 'all', new Set())), ['1', '2', '4', '5', '6']);
  assert.deepEqual(ids(viewItems(rows, 'saved', new Set(['1', '2', '3']))), ['1', '2']);
  assert.deepEqual(ids(viewItems(rows, 'week', new Set(), 'shoes')), ['1']);
  assert.deepEqual(ids(viewItems(rows, 'saved', new Set(), 'bags')), []);
});
test('categories are alphabetical, normalized, unique, nonblank and scoped to the view', () => {
  assert.deepEqual(categoriesFor(viewItems(rows, 'all', new Set())), [{ value: 'bags', label: 'Bags' }, { value: 'shoes', label: 'Shoes' }]);
  assert.deepEqual(categoriesFor(viewItems(rows, 'week', new Set())).map(c => c.value), ['bags', 'shoes']);
  const mixed = parseCSV('name,category\nOne,zara\nTwo,Shirts\nThree,accessories\nFour,Bags');
  assert.deepEqual(categoriesFor(mixed).map(c => c.label), ['accessories', 'Bags', 'Shirts', 'zara']);
  assert.deepEqual(mixed.map(item => item.name), ['One', 'Two', 'Three', 'Four']);
});
test('physical order survives filtering and sorting never mutates source rows', () => {
  const list = viewItems(rows, 'week', new Set());
  assert.deepEqual(ids(filterAndSort(list, '', 'default')), ['1', '4']);
  assert.deepEqual(ids(filterAndSort(list, '', 'price-asc')), ['4', '1']);
  assert.deepEqual(ids(filterAndSort(list, '', 'price-desc')), ['1', '4']);
  assert.deepEqual(ids(filterAndSort(list, '', 'name')), ['4', '1']);
  assert.deepEqual(ids(filterAndSort(rows, 'shoes', 'default')), ['1', '2', '3', '5']);
  assert.deepEqual(ids(list), ['1', '4']);
});
test('CSV supports BOM, CRLF, quoted commas, escaped quotes and multiline cells', () => {
  const parsed = parseCSV('\uFEFFid,name,category,visibility\r\n7,"A, ""fine""\nshirt","  T   Shirts ",WEEKLY\r\n');
  assert.equal(parsed[0].name, 'A, "fine"\nshirt');
  assert.equal(parsed[0].category, 'T Shirts');
  assert.equal(parsed[0].visibility, 'weekly');
  assert.throws(() => parseCSV('<html>Error</html>'));
  assert.throws(() => parseCSV('name\n"unfinished'));
  assert.deepEqual(parseCSV('name,category\n'), []);
});
test('legacy CSV needs no new column, and generated missing IDs are stable', () => {
  const legacy = 'name,category,link\nBag,Bags,https://example.com/bag';
  assert.equal(parseCSV(legacy)[0].visibility, 'catalog');
  assert.equal(parseCSV(legacy)[0].id, parseCSV(legacy)[0].id);
});

test('shared URL filters normalize and filter categories supplied by the catalogue', () => {
  const dynamicRows = parseCSV(`name,category,visibility
One, T   Shirts ,catalog
Two,Shoes,catalog
Three,T Shirts,weekly`);
  const filters = catalogueFiltersFromQuery({ view: 'all', category: '  T SHIRTS  ' });
  const available = categoriesFor(viewItems(dynamicRows, filters.view, new Set()));

  assert.deepEqual(filters, { view: 'all', category: 't shirts' });
  assert.ok(available.some(option => option.value === filters.category));
  assert.deepEqual(ids(filterAndSort(viewItems(dynamicRows, filters.view, new Set()), filters.category, 'default')), [dynamicRows[0].id, dynamicRows[2].id]);
  assert.deepEqual(catalogueFiltersFromQuery({ view: 'unknown', category: ['Shoes', 'Bags'] }), { view: null, category: 'shoes' });
});

test('category sheet order overrides shared Main positions without changing All or explicit sorting', () => {
  const items = [
    {id:'a',name:'Alpha',_category:'watches',categoryOrder:{watches:1}},
    {id:'b',name:'Beta',_category:'watches',categoryOrder:{watches:0}},
  ];
  assert.deepEqual(filterAndSort(items, 'watches', 'default').map(i=>i.id), ['b','a']);
  assert.deepEqual(filterAndSort(items, '', 'default').map(i=>i.id), ['a','b']);
  assert.deepEqual(filterAndSort(items, 'watches', 'name').map(i=>i.id), ['a','b']);
  assert.deepEqual(items.map(i=>i.id), ['a','b']);
});

test('saved search stays scoped and personally bought excludes hidden entries', () => {
  assert.deepEqual(ids(viewItems(rows, 'saved', new Set(['2']), 'weekly')), []);
  assert.deepEqual(ids(viewItems(rows, 'saved', new Set(['2']), 'shoes')), ['2']);
  assert.deepEqual(ids(viewItems([{...rows[0],personallyBought:true},{...rows[2],personallyBought:true}], 'bought', new Set())), ['1']);
});
test('price sorting uses selected currency and keeps unknown or zero prices last', () => {
  const list = [{id:'a',prices:{USD:10,CNY:90}}, {id:'b',prices:{USD:20,CNY:50}}, {id:'c',prices:{USD:0}}];
  assert.deepEqual(ids(filterAndSort(list,'','price-asc','CNY')), ['b','a','c']);
  assert.deepEqual(ids(filterAndSort(list,'','price-desc','CNY')), ['a','b','c']);
  assert.deepEqual(ids(filterAndSort(list,'','price-asc','USD')), ['a','b','c']);
});

test('CAD estimates convert USD consistently for display and sorting', () => {
 const {priceAmount}=require('../lib/catalogue');
 assert.equal(priceAmount({prices:{USD:10}}, 'CAD', 1.4188),14.19);
 assert.ok(Number.isNaN(priceAmount({prices:{USD:0}}, 'CAD', 1.4188)));
 assert.deepEqual(ids(filterAndSort([{id:'b',prices:{USD:20}},{id:'a',prices:{USD:10}}],'','price-asc','CAD',1.4188)),['a','b']);
});
test('MAIN tab is hidden while its products remain in All Finds',()=>{
 const items=parseCSV('id,name,category\n1,Shirt,MAIN\n2,Hoodie,Hoodies');
 assert.deepEqual(categoriesFor(items),[{value:'hoodies',label:'Hoodies'}]);
 assert.equal(viewItems(items,'all',new Set()).length,2);
});
test('exchange rate parsing rejects bad upstream values',()=>{
 const {parseRate}=require('../lib/exchange-rate');
 assert.equal(parseRate({observations:[{d:'2026-09-29',FXUSDCAD:{v:'1.4188'}}]}).usdToCad,1.4188);
 assert.throws(()=>parseRate({observations:[]}));
 assert.throws(()=>parseRate({observations:[{d:'2026-09-29',FXUSDCAD:{v:'0'}}]}));
});
