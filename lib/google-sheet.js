const { createHash } = require('node:crypto');
const { normalizeSearch } = require('./catalogue');
const SHEET_ID = '1ISOjOe2mWaPv1ko9OfpEc40M1VwHvYtOebb86HrImQY';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
function safeUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? value : ''; } catch { return ''; }
}
function linkOf(cell = {}) {
  return safeUrl(cell.hyperlink || cell.textFormatRuns?.find(run => run.format?.link?.uri)?.format.link.uri ||
    cell.userEnteredValue?.formulaValue?.match(/HYPERLINK\s*\(\s*"([^"]+)"/i)?.[1] || cell.formattedValue || '');
}
function numberOf(cell) {
  const n = cell?.effectiveValue?.numberValue ?? cell?.userEnteredValue?.numberValue;
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function importSheet(workbook, importedAt = new Date().toISOString()) {
  const items = new Map();
  const collections = [];
  for (const sheet of workbook.sheets || []) {
    const category = sheet.properties.title.trim();
    collections.push(category);
    for (const grid of sheet.data || []) {
      (grid.rowData || []).forEach((row, offset) => {
        const cells = row.values || [];
        const name = (cells[0]?.formattedValue || cells[0]?.userEnteredValue?.stringValue || '').trim();
        // Both observed layouts: name/link/CNY/USD and name/image/link/CNY/USD.
        const linkIndex = [1, 2].find(index => linkOf(cells[index]));
        if (!name || linkIndex === undefined) return;
        const link = linkOf(cells[linkIndex]);
        const cny = numberOf(cells[linkIndex + 1]);
        const usd = numberOf(cells[linkIndex + 2]);
        if (cny === null && usd === null) return; // Banners, headings, and signup links aren't products.
        const prices = { CNY: cny, USD: usd };
        for (const cell of cells.slice(linkIndex + 3)) {
          const value = numberOf(cell);
          if (value !== null && /€/.test(cell.formattedValue || '')) prices.EUR = value;
          if (value !== null && /£/.test(cell.formattedValue || '')) prices.GBP = value;
        }
        const image = cells.map(cell => safeUrl(cell.userEnteredValue?.formulaValue?.match(/IMAGE\s*\(\s*"([^"]+)"/i)?.[1])).find(Boolean) || '';
        // Preserve variants and differing prices. Exact repeated listings share collection memberships.
        const identity = `${name}\n${link}\n${cny}\n${usd}`;
        const id = createHash('sha256').update(identity).digest('hex').slice(0, 24);
        const source = { sheetId: sheet.properties.sheetId, row: (grid.startRow || 0) + offset + 1 };
        if (items.has(id)) {
          const item = items.get(id);
          if (!item.categories.includes(category)) item.categories.push(category);
          if (!item.image && image) item.image = image;
          return;
        }
        items.set(id, { id, name, link, image, prices, price_usd: usd ?? '', category, categories: [category], visibility: 'catalog', source });
      });
    }
  }
  return { spreadsheetId: SHEET_ID, sourceUrl: SHEET_URL, importedAt, collections, items: [...items.values()] };
}
function searchableItems(items) {
  return items.map(item => ({ ...item, _category: item.category.toLowerCase(),
    _categories: item.categories.map(value => value.toLowerCase()),
    _search: normalizeSearch(`${item.name} ${item.categories.join(' ')}`) }));
}
module.exports = { SHEET_ID, SHEET_URL, safeUrl, importSheet, searchableItems };
