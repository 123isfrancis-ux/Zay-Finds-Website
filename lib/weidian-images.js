function weidianId(link) {
  try {
    let url = new URL(link);
    if (/(^|\.)kakobuy\.com$/.test(url.hostname)) url = new URL(url.searchParams.get('url'));
    if (!/(^|\.)weidian\.com$/.test(url.hostname)) return null;
    const id = url.searchParams.get('itemID');
    return /^\d+$/.test(id || '') ? id : null;
  } catch { return null; }
}
function decodeHtml(text) {
  return text.replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, dec) => String.fromCodePoint(parseInt(hex || dec, hex ? 16 : 10)))
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('\\/', '/');
}
function extractImage(html, expectedId) {
  const text = decodeHtml(html);
  // These adjacent fields come from the public listing's item information.
  // Do not select an arbitrary page image (shop logos and banners are also present).
  const info = text.match(/"item_head"\s*:\s*"([^"\s]+)"([\s\S]{0,1000}?)"item_id"\s*:\s*"?(\d+)"?/);
  if (!info || info[3] !== expectedId) return null;
  try {
    const url = new URL(info[1]);
    return url.protocol === 'https:' && url.hostname === 'si.geilicdn.com' ? url.href : null;
  } catch { return null; }
}
function applyImages(items, images) {
  return items.map(item => {
    const id = weidianId(item.link);
    const image = id && images[id]?.image;
    return image ? { ...item, image } : item;
  });
}
module.exports = { weidianId, extractImage, applyImages };
