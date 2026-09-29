const {test}=require('node:test');
const assert=require('node:assert/strict');
const {affiliateLink,SIGNUP_URL}=require('../lib/affiliate');
test('affiliate rewrite preserves product destination and uses ZAYFINDS',()=>{
 const link='https://item.kakobuy.com/item/details?url=https%3A%2F%2Fitem.taobao.com%2Fitem.htm%3Fid%3D862069546755&affcode=ecdru';
 const rewritten=new URL(affiliateLink(link));
 assert.equal(rewritten.searchParams.get('url'),new URL(link).searchParams.get('url'));
 assert.equal(rewritten.searchParams.get('affcode'),'ZAYFINDS');
 assert.equal(SIGNUP_URL,'https://www.kakobuy.com/register?affcode=ZAYFINDS');
 const short=new URL(affiliateLink('https://ikako.vip/8xhgp'));
 assert.equal(short.searchParams.get('affcode'),'ZAYFINDS');
 assert.equal(short.searchParams.get('url'),'https://weidian.com/item.html?itemID=7711854130');
});
