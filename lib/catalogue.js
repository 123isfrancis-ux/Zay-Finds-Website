// CSV records are kept in physical sheet order, including quoted multiline cells.
function parseCSV(text) {
  const records = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); records.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('Incomplete CSV');
  if (cell || row.length) { row.push(cell); records.push(row); }
  const headers = (records.shift() || []).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  if (!headers.includes('name')) throw new Error('Catalogue is missing the name column');
  return records.map(values => {
    const item = {};
    headers.forEach((header, i) => { item[header] = (values[i] || '').trim(); });
    item.category = cleanCategory(item.category);
    item._category = normalizeCategory(item.category);
    const visibility = (item.visibility || '').trim().toLowerCase();
    item.visibility = ['weekly', 'catalog', 'hidden'].includes(visibility) ? visibility : 'catalog';
    item._search = `${item.name || ''} ${item.category}`.toLowerCase();
    // Existing sheet IDs are unchanged. Rows without IDs get a stable link/name key.
    item.id = item.id || `row-${hash(`${item.link || ''}\u0000${item.name || ''}`)}`;
    return item;
  }).filter(item => item.name);
}

function cleanCategory(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeCategory(value) {
  return cleanCategory(value).toLowerCase();
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function catalogueFiltersFromQuery(query = {}) {
  const requestedView = firstQueryValue(query.view);
  const view = ['week', 'all', 'saved'].includes(requestedView) ? requestedView : null;
  return { view, category: normalizeCategory(firstQueryValue(query.category)) };
}

function hash(value) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return (result >>> 0).toString(36);
}

function viewItems(items, view, saved, query = '') {
  const q = query.trim().toLowerCase();
  return items.filter(item => item.visibility !== 'hidden' && (
    q ? item._search.includes(q) : view === 'saved' ? saved.has(item.id) :
      item.visibility === (view === 'week' ? 'weekly' : 'catalog')
  ));
}

function categoriesFor(items, collectionOrder = []) {
  const unique = new Map();
  items.forEach(item => {
    for (const label of item.categories || [item.category]) {
      const key = normalizeCategory(label);
      if (key && key !== 'cologne' && !unique.has(key)) unique.set(key, label);
    }
  });
  const rank = new Map(collectionOrder.map((label, index) => [normalizeCategory(label), index]));
  return Array.from(unique, ([value, label]) => ({ value, label }))
    .sort((a, b) => (rank.get(a.value) ?? Infinity) - (rank.get(b.value) ?? Infinity) || a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));
}

function filterAndSort(items, category, sort) {
  const list = category ? items.filter(item => (item._categories || [item._category]).includes(category)) : [...items];
  if (category && sort === 'default') {
    list.sort((a, b) => (a.categoryOrder?.[category] ?? Infinity) - (b.categoryOrder?.[category] ?? Infinity));
  }
  if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'price-asc' || sort === 'price-desc') {
    list.sort((a, b) => {
      const left = parseFloat(a.price_usd), right = parseFloat(b.price_usd);
      if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
      if (!Number.isFinite(right)) return -1;
      return sort === 'price-asc' ? left - right : right - left;
    });
  }
  return list;
}

module.exports = { parseCSV, viewItems, categoriesFor, filterAndSort, catalogueFiltersFromQuery };
