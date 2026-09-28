// Browser discovery stays in the supported browser tool; this CLI handles local data and CDN validation.
const fs = require('node:fs');
const path = require('node:path');
const { weidianId, applyImages } = require('../lib/weidian-images');
const { deduplicateProducts } = require('../lib/deduplicate-products');
const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const save = (name, data) => { const target = path.join(root, name); fs.writeFileSync(target+'.tmp', JSON.stringify(data,null,2)+'\n'); fs.renameSync(target+'.tmp',target); };
function queue(category) {
  const items = deduplicateProducts(applyImages(read('data/catalogue.json').items, read('data/weidian-images.json')))
    .filter(item => !category || item.categories.includes(category));
  return { total:items.length, withImages:items.filter(i=>i.image).length,
    pending:items.filter(i=>!i.image).map(i=>({id:weidianId(i.link),name:i.name,link:i.link})) };
}
function validate(row) {
  if (!/^\d+$/.test(row.id || '')) throw Error('Missing numeric product ID');
  const image = new URL(row.image), source = new URL(row.source);
  if (image.protocol !== 'https:' || image.hostname !== 'si.geilicdn.com') throw Error('Unexpected image host');
  if (!/(^|\.)(kakobuy|weidian)\.com$/.test(source.hostname) || source.protocol !== 'https:' || weidianId(row.source)!==row.id) throw Error('Source must resolve to the same product ID');
  if (row.shortLink) { const short = new URL(row.shortLink); if(short.protocol!=='https:'||short.hostname!=='ikako.vip'||short.search||short.hash)throw Error('Unexpected short link'); }
  return row;
}
async function ingest(rows, fetcher=fetch) {
  rows.forEach(validate); // Reject malformed batches before network requests or writes.
  const images=read('data/weidian-images.json'), aliases=read('data/purchase-link-aliases.json');
  const seen=new Set(), verified=new Set(Object.values(images).map(i=>i.image));
  let added=0; const failures=[];
  for(const row of rows) {
    if(seen.has(row.id))continue; seen.add(row.id);
    if(row.shortLink && aliases[row.shortLink] && aliases[row.shortLink]!==row.id)throw Error('Conflicting short-link mapping');
    try {
      if(!verified.has(row.image)) {
        const response=await fetcher(row.image,{method:'HEAD',signal:AbortSignal.timeout(15000)});
        if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error('Image URL did not return an image');
        verified.add(row.image);
      }
      if(!images[row.id]?.image) { images[row.id]={image:row.image,source:row.source,checkedAt:new Date().toISOString()}; added++; }
      if(row.shortLink)aliases[row.shortLink]=row.id;
    }catch(error){ failures.push({id:row.id,reason:error.message}); }
  }
  save('data/weidian-images.json',images);save('data/purchase-link-aliases.json',aliases);
  return {added,failures};
}
async function main() {
  const [command,argument]=process.argv.slice(2);
  if(command==='queue'||command==='coverage') console.log(JSON.stringify(queue(argument),null,2));
  else if(command==='ingest') console.log(JSON.stringify(await ingest(JSON.parse(fs.readFileSync(argument,'utf8'))),null,2));
  else throw Error('Usage: node scripts/catalogue-images.cjs queue|coverage [category] OR ingest batch.json');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={queue,validate};
