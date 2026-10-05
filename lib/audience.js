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
  const name = (item.name || '').toLowerCase().replace(/[’']/g, '');
  const men = /\b(men|mens|man|male|boys)\b/.test(name);
  const women = /\b(women|womens|woman|female|ladies|girls)\b/.test(name);
  if (/\b(unisex|everyone)\b/.test(name) || (men && women)) return 'everyone';
  if (men) return 'men';
  if (women) return 'women';
  const categories = (item.categories || [item.category]).map(c => String(c || '').trim().toLowerCase());
  if (categories.some(c => ['alo women', 'aritzia'].includes(c))) return 'women';
  if (/\b(dress|dresses|skirt|skirts|bra|bras|bikini|bikinis)\b/.test(name) && !/\bdress (shirt|shirts|shoe|shoes|pant|pants|watch|watches)\b/.test(name)) return 'women';
  return 'everyone';
}
module.exports = { audienceFor, normalizeAudience, audienceFromQuery };
