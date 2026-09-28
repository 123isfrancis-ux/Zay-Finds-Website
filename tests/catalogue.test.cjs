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
  assert.deepEqual(ids(viewItems(rows, 'all', new Set())), ['2', '5', '6']);
  assert.deepEqual(ids(viewItems(rows, 'saved', new Set(['1', '2', '3']))), ['1', '2']);
  assert.deepEqual(ids(viewItems(rows, 'week', new Set(), 'shoes')), ['1', '2', '5']);
  assert.deepEqual(ids(viewItems(rows, 'saved', new Set(), 'bags')), ['4']);
});
test('categories are alphabetical, normalized, unique, nonblank and scoped to the view', () => {
  assert.deepEqual(categoriesFor(viewItems(rows, 'all', new Set())), [{ value: 'shoes', label: 'shoes' }]);
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
  assert.deepEqual(ids(filterAndSort(viewItems(dynamicRows, filters.view, new Set()), filters.category, 'default')), [dynamicRows[0].id]);
  assert.deepEqual(catalogueFiltersFromQuery({ view: 'unknown', category: ['Shoes', 'Bags'] }), { view: null, category: 'shoes' });
});
