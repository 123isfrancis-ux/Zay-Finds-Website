const opening = require('../data/watch-opening.json');
const {weidianId} = require('./weidian-images');
const category = 'super clone watches';

// Apply after listing deduplication: these owner-selected photos represent
// separate options at the same seller URL. Keep existing IDs for saved products.
function applyWatchOpening(items) {
 const byListing = new Map(items.map(item => [weidianId(item.link), item]));
 const replacements = new Map(), additions = [];
 opening.forEach((entry, rank) => {
  const base = byListing.get(weidianId(entry.link));
  if (!base || base.visibility === 'hidden') return;
  const variant = {
   ...base,
   ...(entry.image ? {name: entry.name, image: entry.image} : {}),
   categoryOrder: {...base.categoryOrder, [category]: rank},
  };
  if (entry.additionalVariant) {
   variant.id = `${base.id}-watch-${entry.row}`;
   variant.category = 'SUPER CLONE WATCHES';
   variant.categories = ['SUPER CLONE WATCHES'];
   variant.source = {...base.source, sheetId: 111624443, row: entry.row};
   additions.push(variant);
  } else replacements.set(base.id, variant);
 });
 return [...items.map(item => replacements.get(item.id) || {
  ...item,
  categoryOrder: {...item.categoryOrder, ...(Number.isFinite(item.categoryOrder?.[category])
   ? {[category]: item.categoryOrder[category] + opening.length} : {})},
 }), ...additions];
}
module.exports = {applyWatchOpening};
