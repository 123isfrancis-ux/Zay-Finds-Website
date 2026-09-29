const snapshot = require('../data/catalogue.json');
const { deduplicateProducts } = require('./deduplicate-products');
const images = require('../data/weidian-images.json');
const { applyImages, weidianId } = require('./weidian-images');
const categoryOrder = require('../data/category-order.json');
const personallyBought = new Set(require('../data/personally-bought.json'));
const categoryRanks = Object.fromEntries(Object.entries(categoryOrder).map(([category, ids]) =>
  [category, new Map(ids.map((id, index) => [id, index]))]));
function withCategoryOrder(item) {
  const key = weidianId(item.link) || item.link;
  const overrides = key === '7629278372' ? { image: '/owner-photos/dyson-hd08.jpg' }
    : key === '7629274778' ? { image: '/owner-photos/dyson-hd16.jpg' }
    : item.id === '40346506d3f4b6bddd206221' ? { image: '/owner-photos/dji-rsc2.jpg' }
    : key === '7629340798' ? { name: 'Designer Watch Cases' }
    : key === '7849411869' ? { image: '/owner-photos/bruce-wayne.webp' }
    : key === 'https://www.kakobuy.com/item/details?url=https%3A%2F%2Fitem.taobao.com%2Fitem.htm%3Fid%3D862069546755&affcode=ecdru' ? { image: '/owner-photos/ps5.jpg' } : {};
  return { ...item, ...overrides, personallyBought: personallyBought.has(key), categoryOrder: Object.fromEntries(Object.entries(categoryRanks)
    .filter(([, ranks]) => ranks.has(key))
    .map(([category, ranks]) => [category, ranks.get(key)])) };
}
const { searchableItems } = require('./google-sheet');

// An explicit imported snapshot keeps the website usable without Google credentials.
// Refresh with scripts/import-sheet.cjs; the import date is retained in the snapshot.
async function catalogue(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({
    items: searchableItems(deduplicateProducts(applyImages(snapshot.items, images)).map(withCategoryOrder)),
    importedAt: snapshot.importedAt,
    sourceUrl: snapshot.sourceUrl,
    collections: snapshot.collections,
  });
}
module.exports = catalogue;
