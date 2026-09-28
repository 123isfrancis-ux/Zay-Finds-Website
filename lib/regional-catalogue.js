const snapshot = require('../data/catalogue.json');
const images = require('../data/weidian-images.json');
const { applyImages } = require('./weidian-images');
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
    items: searchableItems(applyImages(snapshot.items, images)),
    importedAt: snapshot.importedAt,
    sourceUrl: snapshot.sourceUrl,
    collections: snapshot.collections,
  });
}
module.exports = catalogue;
