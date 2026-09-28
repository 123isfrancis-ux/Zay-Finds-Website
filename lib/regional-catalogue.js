const snapshot = require('../data/catalogue.json');
const { searchableItems } = require('./google-sheet');

// An explicit imported snapshot keeps the website usable without Google credentials.
// Refresh with scripts/import-sheet.cjs; the UI always shows the import date.
async function catalogue(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({
    items: searchableItems(snapshot.items),
    importedAt: snapshot.importedAt,
    sourceUrl: snapshot.sourceUrl,
    collections: snapshot.collections,
  });
}
module.exports = catalogue;
