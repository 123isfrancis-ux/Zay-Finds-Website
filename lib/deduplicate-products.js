const { weidianId } = require('./weidian-images');

// Keep the first spreadsheet entry's identity, price and original purchase URL.
function deduplicateProducts(items) {
  const products = new Map();
  for (const item of items) {
    const listingId = weidianId(item.link);
    const key = listingId ? `weidian:${listingId}` : item.link;
    if (!key) continue;
    const existing = products.get(key);
    if (!existing) {
      products.set(key, { ...item, categories: [...item.categories], alternateNames: [] });
      continue;
    }
    existing.categories = [...new Set([...existing.categories, ...item.categories])];
    if (item.name !== existing.name && !existing.alternateNames.includes(item.name)) existing.alternateNames.push(item.name);
    if (!existing.image && item.image) existing.image = item.image;
  }
  return [...products.values()];
}
module.exports = { deduplicateProducts };
