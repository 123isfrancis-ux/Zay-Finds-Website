const importedListings=new Set(require('../data/imported-watch-listings.json'));
const {weidianId}=require('./weidian-images');
// Only balance a dedicated watch result set. Preserve ranking inside each group.
function mixImportedWatches(items){
 if(!items.length||!items.every(i=>(i.categories||[i.category]).some(c=>String(c).trim().toLowerCase()==='super clone watches')))return [...items];
 const fresh=[],existing=[];
 for(const item of items)(importedListings.has(weidianId(item.link))?fresh:existing).push(item);
 if(!fresh.length||!existing.length)return [...items];
 const result=[];let f=0,e=0;
 for(let position=0;position<items.length;position++){
  const target=Math.floor((position+1)*fresh.length/items.length);
  result.push(f<target?fresh[f++]:existing[e++]);
 }
 return result;
}
module.exports={mixImportedWatches};
