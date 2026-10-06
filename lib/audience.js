// Item-level merchandising labels, reviewed against catalogue photographs.
const reviewedAudiences = require('../data/audience-overrides.json');
const AUDIENCES = ['everyone', 'men', 'women'];
function normalizeAudience(value) {
  return AUDIENCES.includes(value) ? value : 'everyone';
}
function audienceFromQuery(value, preference = 'everyone') {
  return value === undefined ? normalizeAudience(preference) : normalizeAudience(Array.isArray(value) ? value[0] : value);
}
// Explicit product labels take precedence over collection membership. Unknown
// products stay available in both views; a brand alone is not a gender signal.
function audienceFor(item) {
  if (AUDIENCES.includes(item.audience)) return item.audience;
  if (reviewedAudiences[item.id]) return reviewedAudiences[item.id];
  const name = (item.name || '').toLowerCase().replace(/[’']/g, '');
  const men = /\b(men|mens|man|male|boys)\b/.test(name);
  const women = /\b(women|womens|woman|female|ladies|girls)\b/.test(name);
  if (/\b(unisex|everyone)\b/.test(name) || (men && women)) return 'everyone';
  if (men) return 'men';
  if (women) return 'women';
  const categories = (item.categories || [item.category]).map(c => String(c || '').trim().toLowerCase());
  if (categories.some(c => ['alo women', 'aritzia'].includes(c))) return 'women';
  if (/\b(dress|dresses|skirt|skirts|bra|bras|bikini|bikinis)\b/.test(name) && !/\bdress (shirt|shirts|shoe|shoes|pant|pants|watch|watches)\b/.test(name)) return 'women';
  // Specific garment styles, not broad words such as tank, cropped or fitted.
  // Explicit menswear/unisex labels above still take priority.
  if (/\b(blouses?|camisoles?|camis?|corsets?|bustiers?|bralettes?|lingerie|skorts?|panties|ballet flats|mary janes|stilettos|high heels)\b/.test(name)) return 'women';
  if (/\b(off[ -]shoulder|one[ -]shoulder|halter[ -]?(neck|top)|crop tops?|cropped (tank|top)|ruched (top|tank)|bodycon)\b/.test(name)) return 'women';
  if (/\bbodysuits?\b/.test(name) && !/\b(baby|infant|toddler|kids?)\b/.test(name)) return 'women';
  return 'everyone';
}
module.exports = { audienceFor, normalizeAudience, audienceFromQuery };
