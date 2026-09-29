const { weidianId } = require('./weidian-images');
const AFFILIATE_CODE = 'ZAYFINDS';
const SIGNUP_URL = `https://www.kakobuy.com/register?affcode=${AFFILIATE_CODE}`;
function affiliateLink(link) {
  try {
    let url = new URL(link);
    if (url.hostname === 'ikako.vip') {
      const id = weidianId(link);
      if (!id) return link;
      url = new URL('https://www.kakobuy.com/item/details');
      url.searchParams.set('url', `https://weidian.com/item.html?itemID=${id}`);
    }
    if (/(^|\.)kakobuy\.com$/.test(url.hostname)) url.searchParams.set('affcode', AFFILIATE_CODE);
    return url.href;
  } catch { return link; }
}
module.exports = { affiliateLink, SIGNUP_URL };
