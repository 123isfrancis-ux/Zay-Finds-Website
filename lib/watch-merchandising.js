const importedListings=new Set(require('../data/imported-watch-listings.json'));
const {weidianId}=require('./weidian-images');
const openingCount=require('../data/watch-opening.json').length;
// Only balance a dedicated watch result set. Preserve ranking inside each group.
function mixImportedWatches(items){
 if(!items.length||!items.every(i=>(i.categories||[i.category]).some(c=>String(c).trim().toLowerCase()==='super clone watches')))return [...items];
 const pinned=items.filter(item=>item.categoryOrder?.['super clone watches']<openingCount)
  .sort((a,b)=>a.categoryOrder['super clone watches']-b.categoryOrder['super clone watches']);
 const pinnedIds=new Set(pinned.map(item=>item.id));
 const rest=items.filter(item=>!pinnedIds.has(item.id));
 const fresh=[],existing=[];
 for(const item of rest)(importedListings.has(weidianId(item.link))?fresh:existing).push(item);
 if(!fresh.length||!existing.length)return [...pinned,...rest];
 const result=[];let f=0,e=0;
 for(let position=0;position<rest.length;position++){
  const target=Math.floor((position+1)*fresh.length/rest.length);
  result.push(f<target?fresh[f++]:existing[e++]);
 }
 return [...pinned,...result];
}
module.exports={mixImportedWatches};
